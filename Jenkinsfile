pipeline {
    agent any

    environment {
        DEPLOY_DIR = 'E:\\Jenkins\\React\\Test'
        BACKUP_DIR = 'E:\\Jenkins\\React\\Backups'
        MULLAI_DEPLOY_DIR = 'E:\\Jenkins'
        EMAIL_RECIPIENTS = 'santhosh_n@chelsoft.com'
        JENKINS_BASE_URL = 'http://192.168.100.92:8080/'
        SONAR_HOST = 'http://192.168.100.92:9000'
        NPM_CACHE_DIR = "${env.WORKSPACE}\\.npm"
        SONAR_PROJECT_KEY = 'reacttest3'
    }

    triggers {
        cron('0 22 * * 1-5') 
    }

    stages {
        
        stage('Conditional Build Execution') {
            steps {
                script {
                    def isTimer = false
                    def causes = currentBuild.getBuildCauses()
                    for (cause in causes) {
                        if (cause.toString().contains('TimerTrigger')) {
                            isTimer = true
                            break
                        }
                    }

                    if (env.BRANCH_NAME == 'main' && isTimer) {
                        echo "Skipping scheduled build on 'main' branch (manual only)"
                        currentBuild.result = 'NOT_BUILT'
                        error("Aborting scheduled build on 'main'")
                    } else {
                        echo "Proceeding with build for branch: ${env.BRANCH_NAME}"
                    }
                }
            }
        }

        
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                bat 'npm install'
            }
        }
        
        stage('Install Cypress Binary') {
            steps {
                script {
                    def cypressBinaryPath = "${env.USERPROFILE}\\.cache\\Cypress\\${env.CYPRESS_VERSION ?: '14.5.2'}\\Cypress.exe"

                    if (fileExists(cypressBinaryPath)) {
                        echo "✅ Cypress already installed at ${cypressBinaryPath}"
                    } else {
                        echo "⬇️ Installing Cypress binary..."
                        bat 'npx cypress install'
                    }
                }
            }
        }

        stage('Run Tests (Jest)') {
            steps {
                bat 'npm test -- --ci --coverage --passWithNoTests'
            }
            post {
                always {
                    archiveArtifacts artifacts: 'coverage/**/*', allowEmptyArchive: true
                    publishHTML(target: [
                        reportDir: 'coverage',
                        reportFiles: 'lcov-report/index.html',
                        reportName: 'Jest Coverage Report',
                        keepAll: true,
                        alwaysLinkToLastBuild: true
                    ])
                }
                failure {
                    script {
                        def testReport = "coverage/lcov-report/index.html"
                        if (fileExists(testReport)) {
                            sendStageFailureMail("Jest Unit Tests", testReport)
                        }
                    }
                }
            }
        }

        stage('Run E2E Tests (Cypress)') {
            steps {
                script {
                    bat 'npm run build'
                    bat 'start /B cmd /C "npx serve -s build -l 3000"'

                    // Wait for server using pure CMD
                    bat """
                    @echo off
                    setlocal EnableDelayedExpansion

                    set "MAX_ATTEMPTS=30"
                    set "ATTEMPT=0"

                    :loop
                    curl -s -o nul http://localhost:3000
                    if !errorlevel! == 0 (
                        echo ✅ App is up and responding.
                        exit /b 0
                    )

                    set /a ATTEMPT+=1
                    echo Attempt !ATTEMPT! failed. Waiting...

                    if !ATTEMPT! GEQ !MAX_ATTEMPTS! (
                    echo ❌ App did not respond after !MAX_ATTEMPTS! attempts.
                    exit /b 1
                    )

                    timeout /t 1 > nul
                    goto loop
                    """

                    // Run Cypress after confirming app is up
                    bat 'npx cypress run'
                }
            }
        }

    // stage('Prettier Format Check') {
    //     steps {
    //        script {
    //            def result = bat(script: 'npx prettier --write . > prettier-report.txt', returnStatus: true)
    //            if (result != 0) {
    //                echo "Prettier formatting issues found."
    //                sendStageFailureMail("Prettier Format Check", "prettier-report.txt")
    //                error "Stopping pipeline due to Prettier formatting issues."
    //            } else {
    //                echo "Prettier check passed with no issues."
    //            }
    //        }
    //    }
    // }


        stage('SonarQube Analysis') {
            steps {
                script {
                    withSonarQubeEnv('sonar') {
                        withEnv(["PATH+SONAR=${tool 'SonarQube Scanner'}/bin"]) {
                            bat '''
                                sonar-scanner ^
                                -Dsonar.projectKey=reacttest3 ^
                                -Dsonar.sources=. ^
                                -Dsonar.inclusions=**/*.js,**/*.jsx ^
                                -Dsonar.exclusions=node_modules/**,build/**,coverage/** ^
                                -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info ^
                                -Dsonar.sourceEncoding=UTF-8 ^
                                -Dsonar.verbose=true
                                '''
                        }
                    }        
                }
            }
        }
                                                       

        stage('Generate SonarQube Report') {
            steps {
                withCredentials([string(credentialsId: 'JenkinsHello', variable: 'SONAR_TOKEN')]) {
                    script {
                        def reportDir = "sonar-report-${env.BUILD_NUMBER}"
                        def reportPath = "${reportDir}/index.html"

                        bat """
                            if not exist ${reportDir} mkdir ${reportDir}
                            curl -s -u %SONAR_TOKEN%: "${env.SONAR_HOST}/api/issues/search?componentKeys=reacttest3&resolved=false" -o sonar-issues.json
                        """

                        def json = readJSON file: 'sonar-issues.json'

                        def html = """
                        <html><head><title>Sonar Issues Report</title></head><body>
                        <h2>Unresolved Sonar Issues</h2>
                        <table border="1" cellpadding="5" cellspacing="0">
                        <tr><th>Type</th><th>Severity</th><th>Message</th><th>File</th></tr>
                        """

                        json.issues.each { issue ->
                            def file = issue.component
                            def message = issue.message
                            def severity = issue.severity
                            def type = issue.type
                            def line = issue.line ?: ''
                            html += "<tr><td>${type}</td><td>${severity}</td><td>${message}</td><td>${file}:${line}</td></tr>"
                        }

                        html += "</table></body></html>"
                        writeFile file: reportPath, text: html

                        archiveArtifacts artifacts: "${reportDir}/**", fingerprint: true
                    }
                }
            }
        }

        stage('Wait for Sonar Quality Gate') {
            steps {
                timeout(time: 5, unit: 'MINUTES') {
                    script {
                        def qg = waitForQualityGate()
                        if (qg.status != 'OK') {
                            echo "SonarQube Quality Gate failed: ${qg.status}"
                            def reportPath = "sonar-report-${env.BUILD_NUMBER}/index.html"
                            if (fileExists(reportPath)) {
                                sendStageFailureMail("SonarQube Quality Gate", reportPath)
                            }
                            error "Stopping pipeline due to Quality Gate failure: ${qg.status}"
                        } else {
                        echo "SonarQube Quality Gate passed."
                        }
                    }
                }
            }
        }

        
        stage('Build React App') {
            steps {
                bat 'set CI=false && npm run build'
            }
        }

        stage('Archive React Build') {
            steps {
                archiveArtifacts artifacts: 'build/**/*', fingerprint: true
            }
        }

        stage('Approval to Deploy') {
            steps {
                script {
                    emailext(
                        to: "${env.EMAIL_RECIPIENTS}",
                        subject: "React Build Deployment Approval Needed - ${env.JOB_NAME} #${env.BUILD_NUMBER}",
                        body: """
Hi,

React build is ready for deployment.

Please approve and choose deployment targets:

Project: ${env.JOB_NAME}
Build: #${env.BUILD_NUMBER}
Link: ${env.JENKINS_BASE_URL}job/${env.JOB_NAME}/${env.BUILD_NUMBER}/input

Regards,
Jenkins
""",
                        mimeType: 'text/plain'
                    )
                }
            }
        }

        stage('Select Deployment Targets') {
            steps {
                script {
                    def inputData = input message: 'Select deployment targets:',
                        parameters: [
                            booleanParam(name: 'DEPLOY_LOCAL', defaultValue: false, description: 'Deploy to LOCAL'),
                            booleanParam(name: 'DEPLOY_MULLAI', defaultValue: false, description: 'Deploy to MULLAI')
                        ]
                    env.DEPLOY_LOCAL = inputData.DEPLOY_LOCAL.toString()
                    env.DEPLOY_MULLAI = inputData.DEPLOY_MULLAI.toString()
                }
            }
        }

       stage('Deploy') {
            steps {
                script {
                    if (env.DEPLOY_LOCAL == 'true') {
                        node('LocalMachine') {
                            try {
                                copyBuildArtifacts()
                                deployReactApp('C:\\Deploy\\ReactApp', 'C:\\Backup\\ReactApp')
                            } catch (err) {
                                echo "Deployment failed, retrying once..."
                                try {
                                    deployReactApp('C:\\Deploy\\ReactApp', 'C:\\Backup\\ReactApp')
                                } catch (secondErr) {
                                    echo "Second attempt failed. Rolling back..."
                                    rollbackReactApp('C:\\Deploy\\ReactApp', 'C:\\Backup\\ReactApp')
                                    error "Deployment failed after retry. Rollback triggered."
                                }
                            }
                        }
                    }

                    if (env.DEPLOY_MULLAI == 'true') {
                        node('MullaiMachine') {
                            try {
                                copyBuildArtifacts()
                                deployReactApp('D:\\Mullai\\ReactApp', 'D:\\Mullai\\Backups')
                            } catch (err) {
                                echo "Deployment failed, retrying once..."
                                try {
                                    deployReactApp('D:\\Mullai\\ReactApp', 'D:\\Mullai\\Backups')
                                } catch (secondErr) {
                                    echo "Second attempt failed. Rolling back..."
                                    rollbackReactApp('D:\\Mullai\\ReactApp', 'D:\\Mullai\\Backups')
                                    error "Deployment failed after retry. Rollback triggered."
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    post {
        success {
            echo 'Deployment completed successfully.'
        }
        failure {
            echo 'Deployment failed.'
        }
        always {
            echo 'Pipeline execution finished.'
        }
    }
}

def rollbackReactApp(deployDir, backupDir) {
    bat """
        @echo off
        setlocal

        echo Searching latest backup...
        for /f "delims=" %%A in ('dir "${backupDir}\\ReactBuildBackup-*.zip" /b /o-d') do (
            set "latest=%%A"
            goto :found
        )
        echo No backup found! Rollback failed.
        exit /b 1

        :found
        echo Found latest backup: %latest%

        echo Cleaning current deployment...
        rmdir /S /Q "${deployDir}"
        mkdir "${deployDir}"

        echo Extracting backup to deploy folder...
        powershell -Command "Expand-Archive -Path '${backupDir}\\\\%latest%' -DestinationPath '${deployDir}' -Force"

        echo Restarting Apache...
        net stop Apache2.4 || echo Apache not running
        net start Apache2.4

        echo Restarting IIS...
        iisreset

        endlocal
    """
}

def deployReactApp(deployDir, backupDir) {
    def timestamp = new Date().format('yyyyMMdd-HHmmss')
    def backupFile = "${backupDir}\\ReactBuildBackup-${timestamp}.zip"

    bat """
        @echo off
        setlocal enabledelayedexpansion

        rem =============================
        rem Step 1: Ensure backup folder exists
        rem =============================
        if not exist "${backupDir}" (
            echo Creating backup directory...
            mkdir "${backupDir}"
        )

        rem ================================================
        rem Step 2: Delete old backups (keep only latest 5)
        rem ================================================
        echo Cleaning old backups (keeping last 5)...
        for /f "skip=5 delims=" %%A in ('dir "${backupDir}\\ReactBuildBackup-*.zip" /b /o-d 2^>nul') do (
            echo Deleting old backup: %%A
            del "${backupDir}\\%%A"
        )

        rem ===============================================
        rem Step 3: Create ZIP backup using built-in methods
        rem ===============================================
        echo Checking if there is anything to back up...
        dir "${deployDir}\\*" >nul 2>&1
        if !errorlevel! EQU 0 (
            echo Creating ZIP backup using makecab workaround...
            makecab /D CompressionType=LZX /D CompressionMemory=21 /D MaxDiskSize=0 /D CabinetName1=backup.cab /D DiskDirectory1="${backupDir}" /f "${deployDir}\\*.*" >nul
            rename "${backupDir}\\backup.cab" "ReactBuildBackup-${timestamp}.zip"
        ) else (
            echo No existing build to backup. Proceeding without backup.
        )

        rem =====================================================
        rem Step 4: If backup failed but files existed, abort
        rem =====================================================
        if exist "${deployDir}\\*" if not exist "${backupFile}" (
            echo ERROR: Backup failed even though files existed.
            exit /b 1
        )

        rem =============================
        rem Step 5: Copy new React build
        rem =============================
        echo Copying new build to ${deployDir}...
        xcopy /E /I /Y build\\* "${deployDir}\\"

        rem =======================
        rem Step 6: Restart Apache
        rem =======================
        echo Restarting Apache...
        net stop Apache2.4 >nul 2>&1
        net start Apache2.4

        rem ====================
        rem Step 7: Restart IIS
        rem ====================
        echo Restarting IIS...
        iisreset

        endlocal
    """
}


def copyBuildArtifacts() {
    copyArtifacts(
        projectName: env.JOB_NAME,
        selector: specific("${env.BUILD_NUMBER}"),
        filter: 'build/**/*',
        target: '.',
        flatten: false,
        optional: false
    )
}

def sendStageFailureMail(String stageName, String reportPath) {
    emailext(
        subject: "${stageName} Failed - ${env.JOB_NAME} #${env.BUILD_NUMBER}",
        body: """<p>Hi Team,</p>
                 <p>The <strong>${stageName}</strong> stage failed in <strong>${env.JOB_NAME} #${env.BUILD_NUMBER}</strong>.</p>
                 <p><a href="${env.BUILD_URL}artifact/${reportPath}">Click here</a> to view the report.</p>
                 <p>Regards,<br/>Jenkins</p>""",
        mimeType: 'text/html',
        attachmentsPattern: reportPath,
        to: "${env.EMAIL_RECIPIENTS}"
    )
}

