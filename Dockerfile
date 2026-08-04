# ---- stage 1: build (the "workshop": JDK + Maven, compiles source into a jar) ----
# maven image bundles Maven + a JDK; the -21 flavor matches pom.xml's <java.version>21</java.version>
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app

# copy pom.xml FIRST and download deps as its own layer — so editing code below
# doesn't re-download every dependency (same "deps before code" caching trick as whisper's model bake)
COPY pom.xml .
RUN mvn dependency:go-offline

# now copy the source and build the fat jar. -DskipTests: tests need a DB/env we don't have at build time
COPY src ./src
RUN mvn clean package -DskipTests

# ---- stage 2: runtime (the "shipping box": slim JRE, just runs the finished jar) ----
# -jre = runtime only (no compiler/Maven) → much smaller than the build image
FROM eclipse-temurin:21-jre
WORKDIR /app

# ffmpeg is a RUNTIME dep (extractAudio shells out to it). rm the apt cache to keep the image small
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

# reach back into stage 1 and grab ONLY the jar — the JDK, Maven, and source stay behind
COPY --from=build /app/target/speakle-0.0.1-SNAPSHOT.jar app.jar

EXPOSE 8080
CMD ["java", "-jar", "app.jar"]
