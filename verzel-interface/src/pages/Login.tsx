import { Gavel, UserRound } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../lib/errors';

const DEMO_ACCOUNTS = [
	{ email: 'leiloeiro@verzel.com', label: 'Leiloeiro', icon: Gavel },
	{ email: 'ana@verzel.com', label: 'Ana (licitante)', icon: UserRound },
	{ email: 'bruno@verzel.com', label: 'Bruno (licitante)', icon: UserRound },
];

export default function Login() {
	const { login } = useAuth();
	const navigate = useNavigate();
	const location = useLocation();
	const [searchParams] = useSearchParams();
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (searchParams.get('expirado')) toast('Sua sessão expirou. Entre novamente.', { icon: '🔒' });
	}, [searchParams]);

	async function signIn(loginEmail: string, loginPassword: string) {
		setLoading(true);
		try {
			const user = await login(loginEmail, loginPassword);
			toast.success(`Bem-vindo(a), ${user.name}!`);
			const from = (location.state as { from?: string } | null)?.from;
			navigate(from ?? (user.role === 'AUCTIONEER' ? '/painel' : '/'), { replace: true });
		} catch (error) {
			toast.error(getErrorMessage(error, 'Erro ao fazer login'));
		} finally {
			setLoading(false);
		}
	}

	function handleSubmit(event: FormEvent) {
		event.preventDefault();
		signIn(email, password);
	}

	return (
		<Layout>
			<div className="mx-auto max-w-md">
				<h1 className="text-center font-serif text-3xl font-semibold">Entrar</h1>
				<p className="mt-2 text-center text-stone-600 dark:text-stone-400">
					Acompanhe os lotes ao vivo e dê seus lances.
				</p>

				<Card className="mt-8 p-6">
					<form onSubmit={handleSubmit} className="flex flex-col gap-4">
						<Input
							label="E-mail"
							type="email"
							autoComplete="email"
							required
							value={email}
							onChange={(event) => setEmail(event.target.value)}
						/>
						<Input
							label="Senha"
							type="password"
							autoComplete="current-password"
							required
							value={password}
							onChange={(event) => setPassword(event.target.value)}
						/>
						<Button type="submit" fullWidth loading={loading}>
							Entrar
						</Button>
					</form>
					<p className="mt-4 text-center text-sm text-stone-600 dark:text-stone-400">
						Ainda não tem conta?{' '}
						<Link
							to="/cadastro"
							className="font-semibold text-brand-700 hover:underline dark:text-brand-400"
						>
							Cadastre-se
						</Link>
					</p>
				</Card>

				<Card className="mt-4 p-5">
					<p className="text-sm font-semibold">Contas de demonstração</p>
					<p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
						Criadas pelo seed, todas com a senha <code className="font-mono">senha123</code>.
					</p>
					<div className="mt-3 grid gap-2 sm:grid-cols-3">
						{DEMO_ACCOUNTS.map((account) => (
							<Button
								key={account.email}
								variant="secondary"
								size="sm"
								disabled={loading}
								onClick={() => signIn(account.email, 'senha123')}
							>
								<account.icon className="size-4" />
								{account.label}
							</Button>
						))}
					</div>
				</Card>
			</div>
		</Layout>
	);
}
