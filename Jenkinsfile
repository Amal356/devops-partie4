// TP9 + TP10 : Jenkinsfile déclaratif de contact-api
// TP9  : agents Docker, parallélisme, JUnit, image taguée au SHA, push uniquement sur main
// TP10 : quality gates de sécurité (Gitleaks, Semgrep, npm audit en parallèle) + scan Trivy de l'image
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
    // Outils de sécurité : versions épinglées (supply chain)
    GITLEAKS_IMAGE = 'ghcr.io/gitleaks/gitleaks:v8.30.1'
    SEMGREP_IMAGE  = 'semgrep/semgrep:1.183.0'
    TRIVY_IMAGE    = 'aquasec/trivy:0.76.2'
    // SHORT_SHA est calculé dans le stage Checkout : GIT_COMMIT n'est connu qu'après le checkout
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
        script {
          env.SHORT_SHA = env.GIT_COMMIT.take(7)
        }
        sh 'mkdir -p reports' // tous les rapports de sécurité vont dans reports/
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

    // TP10 partie 6 : shift left dans Jenkins. Un seul scanner qui échoue = pipeline rouge.
    stage('Security') {
      parallel {
        stage('Secrets (Gitleaks)') {
          steps {
            // Historique Git complet. -u : même UID que jenkins, sinon "dubious ownership".
            sh '''
              docker run --rm -u "$(id -u):$(id -g)" -v "$PWD:/repo" "$GITLEAKS_IMAGE" \
                git /repo --redact --report-format json --report-path /repo/reports/gitleaks.json
            '''
          }
        }
        stage('SAST (Semgrep)') {
          steps {
            // --error : code retour 1 s'il y a un finding. Rapport SARIF archivé.
            sh '''
              docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD:/src" -w /src "$SEMGREP_IMAGE" \
                semgrep scan --config p/javascript --config p/owasp-top-ten \
                --exclude node_modules --exclude reports \
                --metrics=off --error --sarif -o reports/semgrep.sarif .
            '''
          }
        }
        stage('Dependencies (npm audit)') {
          agent { docker { image 'node:24-alpine'; args '-e HOME=/tmp'; reuseNode true } }
          steps {
            // Le rapport est écrit AVANT de renvoyer le code retour (sinon un échec n'archive rien).
            sh '''
              set +e
              npm audit --omit=dev --audit-level=high > reports/npm-audit.txt 2>&1
              rc=$?
              cat reports/npm-audit.txt
              exit $rc
            '''
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

    // TP10 partie 6 : on ne pousse jamais une image avec une vulnérabilité CRITICAL corrigeable.
    stage('Image scan') {
      steps {
        // Cache de la base de vulnérabilités dans JENKINS_HOME : évite de la retélécharger (et de saturer le disque).
        // --group-add : accès au socket Docker sans être root. Rapport écrit même en cas d'échec, puis code retour.
        sh '''
          mkdir -p "$JENKINS_HOME/.cache/trivy"
          set +e
          docker run --rm -u "$(id -u):$(id -g)" \
            --group-add "$(stat -c %g /var/run/docker.sock)" \
            -v /var/run/docker.sock:/var/run/docker.sock \
            -v "$JENKINS_HOME/.cache/trivy:/tmp/trivy" -e TRIVY_CACHE_DIR=/tmp/trivy \
            -v "$PWD/reports:/reports" \
            "$TRIVY_IMAGE" image --severity CRITICAL --ignore-unfixed --exit-code 1 \
            --format table --output /reports/trivy-image.txt "$IMAGE_NAME:$SHORT_SHA"
          rc=$?
          cat reports/trivy-image.txt
          exit $rc
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
      // rapports de sécurité archivés même si le pipeline est rouge (c'est là qu'on en a besoin)
      archiveArtifacts artifacts: 'reports/**', allowEmptyArchive: true
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
