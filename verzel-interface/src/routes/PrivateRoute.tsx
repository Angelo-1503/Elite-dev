import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { Role } from '../types';

interface PrivateRouteProps {
	children: ReactNode;
	requiredRole?: Role;
}

export default function PrivateRoute({ children, requiredRole }: PrivateRouteProps) {
	const { user } = useAuth();
	const location = useLocation();

	if (!user) {
		return <Navigate to="/login" replace state={{ from: location.pathname }} />;
	}

	if (requiredRole && user.role !== requiredRole) {
		return <Navigate to={user.role === 'AUCTIONEER' ? '/painel' : '/'} replace />;
	}

	return <>{children}</>;
}
