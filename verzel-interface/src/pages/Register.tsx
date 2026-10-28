import { Gavel, HandCoins } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import toast from 'react-hot-toast';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../lib/errors';
import type { Role } from '../types';

const ROLE_OPTIONS: { value: Role; title: string; description: string; icon: typeof Gavel }[] = [
	{
		value: 'BIDDER',
		title: 'Licitante',
		description: 'Deposita saldo, dá lances e arremata obras.',
		icon: HandCoins,
	},
	{
		value: 'AUCTIONEER',
		title: 'Leiloeiro',
		description: 'Cria e gerencia os próprios lotes. Não dá lances.',
		icon: Gavel,
	},
];

export default function Register() {
	const { register } = useAuth();
	const navigate = useNavigate();
	const [name, setName] = useState('');
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [role, setRole] = useState<Role>('BIDDER');
	const [loading, setLoading] = useState(false);

	async function handleSubmit(event: FormEvent) {
		event.preventDefault();
		setLoading(true);
		try {
			const user = await register({ name, email, password, role });
			toast.success('Conta criada com sucesso!');
			navigate(user.role === 'AUCTIONEER' ? '/painel' : '/carteira', { replace: true });
		} catch (error) {
			toast.error(getErrorMessage(error, 'Erro ao criar conta'));
		} finally {
			setLoading(false);
		}
	}

	return (
		<Layout>
			<div className="mx-auto max-w-lg">
				<h1 className="text-center font-serif text-3xl font-semibold">Criar conta</h1>
				<p className="mt-2 text-center text-stone-600 dark:text-stone-400">
					Escolha como você vai participar dos leilões.
				</p>

				<Card className="mt-8 p-6">
					<form onSubmit={handleSubmit} className="flex flex-col gap-4">
						<fieldset>
							<legend className="mb-2 text-sm font-medium text-stone-700 dark:text-stone-300">
								Tipo de conta
							</legend>
							<div className="grid gap-3 sm:grid-cols-2">
								{ROLE_OPTIONS.map((option) => (
									<label
										key={option.value}
										className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition ${
											role === option.value
												? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/30 dark:bg-brand-900/20'
												: 'border-stone-200 hover:border-stone-300 dark:border-stone-700'
										}`}
									>
										<input
											type="radio"
											name="role"
											value={option.value}
											checked={role === option.value}
											onChange={() => setRole(option.value)}
											className="sr-only"
										/>
										<option.icon className="mt-0.5 size-5 shrink-0 text-brand-600 dark:text-brand-400" />
										<span>
											<span className="block font-semibold">{option.title}</span>
											<span className="text-sm text-stone-500 dark:text-stone-400">
												{option.description}
											</span>
										</span>
									</label>
								))}
							</div>
						</fieldset>

						<Input
							label="Nome"
							required
							minLength={2}
							maxLength={100}
							autoComplete="name"
							value={name}
							onChange={(event) => setName(event.target.value)}
						/>
						<Input
							label="E-mail"
							type="email"
							required
							autoComplete="email"
							value={email}
							onChange={(event) => setEmail(event.target.value)}
						/>
						<Input
							label="Senha"
							type="password"
							required
							minLength={6}
							autoComplete="new-password"
							hint="Mínimo de 6 caracteres."
							value={password}
							onChange={(event) => setPassword(event.target.value)}
						/>
						<Button type="submit" fullWidth loading={loading}>
							Criar conta
						</Button>
					</form>
					<p className="mt-4 text-center text-sm text-stone-600 dark:text-stone-400">
						Já tem conta?{' '}
						<Link
							to="/login"
							className="font-semibold text-brand-700 hover:underline dark:text-brand-400"
						>
							Entrar
						</Link>
					</p>
				</Card>
			</div>
		</Layout>
	);
}
