// Custom Swagger UI Script for Auto-Authorization
(function () {
    'use strict';

    // Wait for Swagger UI to load
    window.addEventListener('load', function () {
        console.log('🔐 Auto-Authorization Script Loaded');

        // Check if we have a saved token
        const savedToken = localStorage.getItem('authToken');
        if (savedToken) {
            console.log('✅ Found saved token, auto-authorizing...');
            setTimeout(() => {
                try {
                    // Auto-fill the authorization
                    const ui = window.ui;
                    if (ui) {
                        ui.preauthorizeApiKey('bearerAuth', savedToken);
                        console.log('✅ Auto-authorized with saved token');
                    }
                } catch (err) {
                    console.error('❌ Auto-authorization failed:', err);
                }
            }, 500);
        }

        // Intercept successful login responses to save token
        const originalFetch = window.fetch;
        window.fetch = function (...args) {
            return originalFetch.apply(this, args).then(response => {
                // Clone response so we can read it
                const clonedResponse = response.clone();

                // Check if this is a login request
                const url = args[0];
                if (typeof url === 'string' && url.includes('/auth/login')) {
                    clonedResponse.json().then(data => {
                        if (data && data.data && data.data.token) {
                            const token = data.data.token;
                            console.log('🎉 Login successful! Saving token...');

                            // Save token to localStorage
                            localStorage.setItem('authToken', token);

                            // Also save refresh token if available
                            if (data.data.refreshToken) {
                                localStorage.setItem('refreshToken', data.data.refreshToken);
                            }

                            // Auto-authorize Swagger UI
                            setTimeout(() => {
                                try {
                                    const ui = window.ui;
                                    if (ui) {
                                        ui.preauthorizeApiKey('bearerAuth', token);
                                        console.log('✅ Swagger UI auto-authorized!');

                                        // Show success message
                                        alert('🎉 Login successful! All API requests will now use your authentication token automatically.');
                                    }
                                } catch (err) {
                                    console.error('❌ Auto-authorization failed:', err);
                                }
                            }, 500);
                        }
                    }).catch(err => {
                        console.error('Error parsing login response:', err);
                    });
                }

                return response;
            });
        };

        // Add logout button to clear tokens
        setTimeout(() => {
            try {
                const topbar = document.querySelector('.swagger-ui .topbar');
                if (topbar && !document.getElementById('custom-logout-btn')) {
                    const logoutBtn = document.createElement('button');
                    logoutBtn.id = 'custom-logout-btn';
                    logoutBtn.innerHTML = '🚪 Clear Auth Token';
                    logoutBtn.style.cssText = `
                        position: absolute;
                        right: 20px;
                        top: 15px;
                        padding: 8px 16px;
                        background: #ff4444;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        font-weight: bold;
                        font-size: 14px;
                    `;
                    logoutBtn.onclick = function () {
                        localStorage.removeItem('authToken');
                        localStorage.removeItem('refreshToken');
                        console.log('🚪 Tokens cleared');
                        alert('Auth tokens cleared! Please login again to use protected endpoints.');
                        window.location.reload();
                    };
                    topbar.appendChild(logoutBtn);
                }
            } catch (err) {
                console.error('Error adding logout button:', err);
            }
        }, 1000);

        // Add info banner
        setTimeout(() => {
            try {
                const infoContainer = document.querySelector('.swagger-ui .information-container');
                if (infoContainer && !document.getElementById('auth-info-banner')) {
                    const banner = document.createElement('div');
                    banner.id = 'auth-info-banner';
                    banner.style.cssText = `
                        background: #e7f3ff;
                        border-left: 4px solid #2196F3;
                        padding: 15px;
                        margin: 20px 0;
                        border-radius: 4px;
                    `;

                    const hasToken = localStorage.getItem('authToken');
                    banner.innerHTML = `
                        <h4 style="margin: 0 0 10px 0; color: #1976D2;">
                            🔐 Authentication Status: ${hasToken ? '✅ Authorized' : '❌ Not Authorized'}
                        </h4>
                        <p style="margin: 0; color: #555;">
                            ${hasToken
                            ? '✅ You are authenticated! All requests will automatically include your auth token.'
                            : '⚠️ Please login using the <strong>POST /auth/login</strong> endpoint below. Your token will be saved automatically.'}
                        </p>
                        ${hasToken ? `
                        <p style="margin: 10px 0 0 0; color: #555; font-size: 13px;">
                            💡 Tip: Use the "Clear Auth Token" button in the top-right corner to logout.
                        </p>
                        ` : ''}
                    `;
                    infoContainer.appendChild(banner);
                }
            } catch (err) {
                console.error('Error adding info banner:', err);
            }
        }, 1000);
    });
})();
