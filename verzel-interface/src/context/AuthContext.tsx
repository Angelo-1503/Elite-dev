import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useState } from 'react';
import api from '../services/api';
import { reconnectSocket } from '../services/socket';
import type { Role, User } from '../types';

interface RegisterData {
	name: string;
	email: string;
	password: string;
	role: Role;
}

interface AuthContextType {
	user: User | null;
	login: (email: string, password: string) => Promise<User>;
	register: (data: RegisterData) => Promise<User>;
	logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

function readStoredUser(): User | null {
	const storedUser = localStorage.getItem('user');
	if (!storedUser || !localStorage.getItem('token')) return null;
	try {
		return JSON.parse(storedUser);
	} catch {
		return null;
	}
}

export function AuthProvider({ children }: { children: ReactNode }) {
	const [user, setUser] = useState<User | null>(readStoredUser);

	const saveSession = useCallback((token: string, sessionUser: User) => {
		localStorage.setItem('token', token);
		localStorage.setItem('user', JSON.stringify(sessionUser));
		setUser(sessionUser);
		reconnectSocket();
		return sessionUser;
	}, []);

	const login = useCallback(
		async (email: string, password: string) => {
			const response = await api.post('/auth/login', { email, password });
			return saveSession(response.data.token, response.data.user);
		},
		[saveSession],
	);

	const register = useCallback(
		async (data: RegisterData) => {
			const response = await api.post('/auth/register', data);
			return saveSession(response.data.token, response.data.user);
		},
		[saveSession],
	);

	const logout = useCallback(() => {
		localStorage.removeItem('token');
		localStorage.removeItem('user');
		setUser(null);
		reconnectSocket();
	}, []);

	return (
		<AuthContext.Provider value={{ user, login, register, logout }}>
			{children}
		</AuthContext.Provider>
	);
}

export function useAuth() {
	const context = useContext(AuthContext);
	if (!context) {
		throw new Error('useAuth must be used inside AuthProvider');
	}
	return context;
}
