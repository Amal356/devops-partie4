// TP9 : Jenkinsfile déclaratif de contact-api
// Partie 2 : agents Docker, parallélisme, JUnit
// Partie 3 : image taguée au SHA Git, credentials Docker Hub, push uniquement sur main
// Plugins : Pipeline, Git, Docker Pipeline, JUnit, Credentials Binding, Workspace Cleanup, Timestamper.

pipeline {
  agent any

  options {
    timestamps()
    timeout(time: 20, unit: 'MINUTES')
    buildDiscarder(logRotator(numToKeepStr: '10'))
    disableConcurrentBuilds() // un seul build à la fois sur la même branche
  }

  environment {
    IMAGE_NAME = 'amal878/contact-api'
    // SHORT_SHA est calculé dans le stage Checkout : GIT_COMMIT n'est connu qu'après le checkout
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
        script {
          env.SHORT_SHA = env.GIT_COMMIT.take(7)
        }
        echo "Commit ${env.GIT_COMMIT} -> tag ${env.SHORT_SHA} (branche ${env.GIT_BRANCH})"
      }
    }

    stage('Install') {
      // Node.js vient de l'image Docker, plus de la VM : build reproductible.
      // reuseNode true : même workspace que le reste du pipeline (node_modules conservé).
      // HOME=/tmp : le conteneur tourne avec l'utilisateur jenkins, qui n'a pas de HOME dans l'image.
      agent { docker { image 'node:24-alpine'; args '-e HOME=/tmp'; reuseNode true } }
      steps {
        sh 'node --version && npm --version'
        sh 'npm ci'
      }
    }

    stage('Quality') {
      parallel {
        stage('Lint') {
          agent { docker { image 'node:24-alpine'; args '-e HOME=/tmp'; reuseNode true } }
          steps {
            sh 'npm run lint'
          }
        }
        stage('Unit tests') {
          agent { docker { image 'node:24-alpine'; args '-e HOME=/tmp'; reuseNode true } }
          steps {
            // rapport JUnit lu par Jenkins (onglet Tests)
            sh 'npm run test:ci'
          }
        }
      }
    }

    stage('Build image') {
      steps {
        // Tag immuable = SHA court du commit ; le label OCI relie l'image au commit exact.
        sh '''
          docker build \
            --label org.opencontainers.image.revision="$GIT_COMMIT" \
            --label org.opencontainers.image.source="https://github.com/Amal356/devops-partie4" \
            -t "$IMAGE_NAME:$SHORT_SHA" .
          echo "$IMAGE_NAME:$SHORT_SHA" > image.txt
        '''
      }
    }

    stage('Push') {
      // Uniquement sur main.
      //  - job Multibranch (partie 4) : BRANCH_NAME = 'main' -> condition "branch"
      //  - job Pipeline simple : BRANCH_NAME n'existe pas, GIT_BRANCH = 'origin/main' -> condition "expression"
      when {
        anyOf {
          branch 'main'
          expression { env.GIT_BRANCH == 'origin/main' }
        }
      }
      steps {
        // Guillemets SIMPLES : c'est le shell qui lit $DH_TOKEN, Groovy ne l'interpole jamais
        // (le secret ne finit ni dans le script généré ni dans les logs, où il apparaît en ****).
        withCredentials([usernamePassword(credentialsId: 'dockerhub',
                          usernameVariable: 'DH_USER', passwordVariable: 'DH_TOKEN')]) {
          sh 'echo "$DH_TOKEN" | docker login -u "$DH_USER" --password-stdin'
          sh 'docker push "$IMAGE_NAME:$SHORT_SHA"'
          sh 'docker tag "$IMAGE_NAME:$SHORT_SHA" "$IMAGE_NAME:latest-main" && docker push "$IMAGE_NAME:latest-main"'
        }
      }
      post {
        always {
          sh 'docker logout || true' // ne pas laisser l'identifiant dans ~/.docker/config.json
        }
      }
    }
  }

  post {
    always {
      // allowEmptyResults : pas d'erreur supplémentaire si le build échoue avant les tests
      junit testResults: 'reports/*.xml', allowEmptyResults: true
      echo "Build ${currentBuild.fullDisplayName} terminé : ${currentBuild.currentResult}"
    }
    success {
      // référence complète de l'image produite, téléchargeable depuis la page du build
      archiveArtifacts artifacts: 'image.txt', allowEmptyArchive: true, fingerprint: true
    }
    failure {
      echo 'Le pipeline a échoué : consultez les logs du stage en rouge.'
    }
    cleanup {
      // l'image est sur Docker Hub (ou inutile hors main) : on libère le disque de la VM
      sh 'docker image rm "$IMAGE_NAME:$SHORT_SHA" "$IMAGE_NAME:latest-main" 2>/dev/null || true'
      cleanWs()
    }
  }
}
