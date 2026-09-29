// Le SDK Android de Tano : le parcours de vérification dans une WebView, et ses événements.
import com.vanniktech.maven.publish.SonatypeHost

plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
    id("com.vanniktech.maven.publish")
}

android {
    namespace = "africa.tano.sdk"
    compileSdk = 36
    defaultConfig {
        minSdk = 24
        consumerProguardFiles("consumer-rules.pro")
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.activity:activity-ktx:1.9.3")
    testImplementation("junit:junit:4.13.2")
    // org.json est fourni par Android ; en test JVM, sa vraie implémentation.
    testImplementation("org.json:json:20240303")
}

// Publication sur Maven Central (Central Portal) : africa.tano:tano-android.
// Identifiants et clé de signature dans ~/.gradle/gradle.properties, jamais dans le dépôt :
// mavenCentralUsername, mavenCentralPassword, signingInMemoryKey, signingInMemoryKeyPassword.
mavenPublishing {
    publishToMavenCentral(SonatypeHost.CENTRAL_PORTAL)
    // Signer quand une clé est fournie ; une publication locale d'essai s'en passe.
    if (providers.gradleProperty("signingInMemoryKey").isPresent) signAllPublications()

    coordinates("africa.tano", "tano-android", "0.1.0")

    pom {
        name.set("Tano Android")
        description.set("Le parcours de vérification d'identité Tano dans une application Android, avec ses événements.")
        inceptionYear.set("2026")
        url.set("https://docs.tano.africa")
        licenses {
            license {
                name.set("MIT License")
                url.set("https://opensource.org/license/mit")
                distribution.set("repo")
            }
        }
        developers {
            developer {
                id.set("qalebasse")
                name.set("Qalebasse")
                url.set("https://tano.africa")
            }
        }
        scm {
            url.set("https://github.com/Qalebasse/tano-sdk")
            connection.set("scm:git:git://github.com/Qalebasse/tano-sdk.git")
            developerConnection.set("scm:git:ssh://git@github.com/Qalebasse/tano-sdk.git")
        }
    }
}
