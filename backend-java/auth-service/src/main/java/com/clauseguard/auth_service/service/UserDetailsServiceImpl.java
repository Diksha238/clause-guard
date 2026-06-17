package com.clauseguard.auth_service.service;

import com.clauseguard.auth_service.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class UserDetailsServiceImpl implements UserDetailsService {

    private final UserRepository userRepository;

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        com.clauseguard.auth_service.model.User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("User not found with email: " + email));

        // Google-authenticated users have no local password — use a non-null placeholder
        // so Spring Security's UserDetails (which requires a non-null password) doesn't break.
        // This placeholder is never used for authentication since OAuth users skip the
        // password-based AuthenticationManager flow entirely.
        String passwordHash = user.getPassword() != null ? user.getPassword() : "{noop}oauth2-user-no-password";

        return User.builder()
                .username(user.getEmail())
                .password(passwordHash)
                .roles(user.getRole())
                .build();
    }
}