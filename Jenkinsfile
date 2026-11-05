// TP9 : Jenkinsfile déclaratif de contact-api (partie 2 : agents Docker, parallélisme, JUnit)
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
    // TODO (partie 3) : SHORT_SHA calculé après le checkout
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
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
        // TODO (partie 3) : docker build ${IMAGE_NAME}:${SHORT_SHA}
        echo 'TODO docker build'
      }
    }

    stage('Push') {
      // TODO (partie 3) : uniquement sur main
      steps {
        echo 'TODO docker push'
      }
    }
  }

  post {
    always {
      // allowEmptyResults : pas d'erreur supplémentaire si le build échoue avant les tests
      junit testResults: 'reports/*.xml', allowEmptyResults: true
      echo "Build ${currentBuild.fullDisplayName} terminé : ${currentBuild.currentResult}"
    }
    failure {
      echo 'Le pipeline a échoué : consultez les logs du stage en rouge.'
    }
    cleanup {
      cleanWs()
    }
  }
}
