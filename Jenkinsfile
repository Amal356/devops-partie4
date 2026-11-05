// TP9 : Jenkinsfile déclaratif à compléter (à placer à la racine du dépôt contact-api du TP8).
// Plugins nécessaires : Pipeline, Git, Docker Pipeline, JUnit, Credentials Binding, Workspace Cleanup.

pipeline {
  agent any

  options {
    timestamps()
    timeout(time: 20, unit: 'MINUTES')
    buildDiscarder(logRotator(numToKeepStr: '10'))
    // TODO (partie 2) : interdire les builds concurrents sur la même branche
  }

  environment {
    IMAGE_NAME = 'amal878/contact-api'
    // TODO (partie 3) : SHORT_SHA = 7 premiers caractères de GIT_COMMIT
    //   astuce : à calculer dans un bloc script { env.SHORT_SHA = ... } car GIT_COMMIT
    //   n'est connu qu'après le checkout
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Install') {
      // TODO (partie 2) : exécuter ce stage dans un agent Docker node:24-alpine
      //   agent { docker { image 'node:24-alpine'; reuseNode true } }
      steps {
        sh 'npm ci'
      }
    }

    stage('Quality') {
      // TODO (partie 2) : exécuter "Lint" et "Unit tests" en parallèle (bloc parallel)
      steps {
        sh 'npm run lint'
        sh 'npm test'
      }
    }

    stage('Build image') {
      steps {
        // TODO (partie 3) : construire ${IMAGE_NAME}:${SHORT_SHA} et ajouter le label
        //   org.opencontainers.image.revision=${GIT_COMMIT}
        echo 'TODO docker build'
      }
    }

    stage('Push') {
      // TODO (partie 3) : uniquement sur la branche main (when { branch 'main' })
      steps {
        // TODO (partie 3) : withCredentials([usernamePassword(credentialsId: 'dockerhub', ...)])
        //   puis docker login --password-stdin, docker push du tag SHORT_SHA et du tag latest-main
        echo 'TODO docker push'
      }
    }
  }

  post {
    always {
      // TODO (partie 2) : publier les résultats JUnit (junit 'reports/*.xml')
      echo "Build ${currentBuild.fullDisplayName} terminé : ${currentBuild.currentResult}"
    }
    success {
      echo 'TODO : archiver un fichier image.txt contenant le nom complet de l image (archiveArtifacts)'
    }
    failure {
      echo 'Le pipeline a échoué : consultez les logs du stage en rouge.'
    }
    cleanup {
      cleanWs()
    }
  }
}
