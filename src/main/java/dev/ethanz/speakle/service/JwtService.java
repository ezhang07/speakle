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

    // verify a token and pull the user id back out
    // invalid/expired tokens are caught by this filter, and requests are rendered unauthenticatde
    public String extractUserId(String token) {
        return Jwts.parser()
            .verifyWith(key) // recompute the signature with our secret and check it matches. If token is altered, this throws
            .build()
            .parseSignedClaims(token) // checks the expiration; expired token throws
            .getPayload()
            .getSubject(); // gets user id we stored in generateToken()
    }
}