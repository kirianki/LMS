import axios from 'axios';
import { useAuthStore } from '@/store/useAuthStore';

const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor for Auth
api.interceptors.request.use((config) => {
    const token = useAuthStore.getState().token;
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
});

// Response interceptor for token refresh
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // If error is 401 and not already retrying
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            const refreshToken = useAuthStore.getState().refreshToken;

            if (refreshToken) {
                try {
                    // Try to refresh the token
                    const response = await axios.post(
                        `${api.defaults.baseURL}/auth/token/refresh/`,
                        { refresh: refreshToken }
                    );

                    const { access, refresh } = response.data;

                    // Update store
                    useAuthStore.getState().refreshTokens(access, refresh || refreshToken);

                    // Update header and retry original request
                    originalRequest.headers.Authorization = `Bearer ${access}`;
                    return api(originalRequest);
                } catch (refreshError) {
                    // If refresh fails, logout
                    useAuthStore.getState().logout();
                    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
                        window.location.href = '/login';
                    }
                }
            } else {
                // No refresh token, logout
                useAuthStore.getState().logout();
                if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
                    window.location.href = '/login';
                }
            }
        }

        return Promise.reject(error);
    }
);

export default api;
