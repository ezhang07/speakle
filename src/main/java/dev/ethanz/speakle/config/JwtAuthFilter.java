package dev.ethanz.speakle.config;

import java.io.IOException;
import java.util.Collections;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import dev.ethanz.speakle.service.JwtService;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

// if the request carries a valid "Authorization: Bearer <token>" header,
// tell Spring who the caller is by putting them in the SecurityContext.
@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService jwtService;

    public JwtAuthFilter(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {

        String authHeader = request.getHeader("Authorization");

        // No Bearer token = nothing to authenticate. Pass it down the chain untouched
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        // get the raw token
        String token = authHeader.substring(7);

        try {
            String userId = jwtService.extractUserId(token); // verifies signature + expiry, throws if bad

            // Only set identity if it isn't already set (avoids clobbering on internal re-dispatches).
            if (SecurityContextHolder.getContext().getAuthentication() == null) {
                // authentication holds all info about the authenticated user
                //  - principal = userId  (what @AuthenticationPrincipal will hand you in Milestone C)
                //  - credentials = null  (we don't keep the password around)
                //  - authorities = empty (no roles/permissions model yet)
                var authentication = new UsernamePasswordAuthenticationToken(
                        userId, null, Collections.emptyList());
                authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request)); // not important

                // Putting it here is what makes .authenticated() in SecurityConfig pass.
                // basically saying the current request is authenticated as this user
                SecurityContextHolder.getContext().setAuthentication(authentication);
            }
        } catch (JwtException e) {
            // Forged / tampered / expired token → leave the context empty.
        }

        filterChain.doFilter(request, response);
    }
}
