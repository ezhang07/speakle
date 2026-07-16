package dev.ethanz.speakle.service;

import java.nio.charset.StandardCharsets;
import java.util.Date;

import javax.crypto.SecretKey;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import dev.ethanz.speakle.entity.User;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;


// user POSTS email + password to endpoint, authservice verifies creds, then authservice calls jwtService to generate token
@Service
public class JwtService {
    private final SecretKey key;

    public JwtService(@Value("${jwt.secret}") String secretKey) {
        this.key = Keys.hmacShaKeyFor(secretKey.getBytes(StandardCharsets.UTF_8)); // convert string to byte array, then to secret key
    }

    public String generateToken(User user) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + 1000L * 60 * 60 * 24); 

        return Jwts.builder()
        .subject(user.getId()) // who the token identifies
        .issuedAt(now) // issue date
        .expiration(expiry) // expiry date (24 hrs after)
        .signWith(key) // hash header+payload with secret, making the signature
        .compact(); // assemble into header.payload.signature string
    }
}