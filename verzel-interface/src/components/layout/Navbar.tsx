import { LogOut, Menu, Moon, Plus, Sun, Wallet, X } from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useWallet } from '../../context/WalletContext';
import { formatBRL } from '../../lib/format';
import Logo from './Logo';

const linkClass = ({ isActive }: { isActive: boolean }) =>
	`rounded-lg px-3 py-2 text-sm font-medium transition ${
		isActive
			? 'bg-stone-100 text-stone-900 dark:bg-stone-800 dark:text-stone-50'
			: 'text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100'
	}`;

export default function Navbar() {
	const { user, logout } = useAuth();
	const { wallet } = useWallet();
	const { theme, toggleTheme } = useTheme();
	const navigate = useNavigate();
	const [open, setOpen] = useState(false);

	const links = [
		{ to: '/', label: 'Vitrine', show: true, end: true },
		{ to: '/meus-lances', label: 'Meus arremates', show: user?.role === 'BIDDER' },
		{ to: '/carteira', label: 'Carteira', show: user?.role === 'BIDDER' },
		{ to: '/painel', label: 'Painel do leiloeiro', show: user?.role === 'AUCTIONEER', end: true },
	].filter((link) => link.show);

	function handleLogout() {
		logout();
		setOpen(false);
		navigate('/');
	}

	const themeButton = (
		<button
			type="button"
			onClick={toggleTheme}
			className="rounded-lg p-2 text-stone-600 transition hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
			aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
			title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
		>
			{theme === 'dark' ? <Sun className="size-5" /> : <Moon className="size-5" />}
		</button>
	);

	return (
		<header className="sticky top-0 z-40 border-b border-stone-200 bg-white/85 backdrop-blur dark:border-stone-800 dark:bg-stone-950/85">
			<div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
				<div className="flex items-center gap-6">
					<Logo />
					<nav className="hidden items-center gap-1 md:flex">
						{links.map((link) => (
							<NavLink key={link.to} to={link.to} end={link.end} className={linkClass}>
								{link.label}
							</NavLink>
						))}
					</nav>
				</div>

				<div className="hidden items-center gap-2 md:flex">
					{user?.role === 'BIDDER' && wallet && (
						<Link
							to="/carteira"
							className="flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-1.5 text-sm dark:border-stone-700"
							title="Saldo disponível para lances"
						>
							<Wallet className="size-4 text-brand-600 dark:text-brand-400" />
							<span className="text-stone-500 dark:text-stone-400">Disponível</span>
							<strong className="tabular">{formatBRL(wallet.availableCents)}</strong>
						</Link>
					)}
					{user?.role === 'AUCTIONEER' && (
						<Link
							to="/painel/novo-lote"
							className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 dark:bg-brand-500 dark:text-stone-950"
						>
							<Plus className="size-4" /> Novo lote
						</Link>
					)}
					{themeButton}
					{user ? (
						<div className="flex items-center gap-2 border-l border-stone-200 pl-3 dark:border-stone-800">
							<div className="text-right leading-tight">
								<p className="text-sm font-medium">{user.name}</p>
								<p className="text-xs text-stone-500">
									{user.role === 'AUCTIONEER' ? 'Leiloeiro' : 'Licitante'}
								</p>
							</div>
							<button
								type="button"
								onClick={handleLogout}
								className="rounded-lg p-2 text-stone-500 hover:bg-stone-100 hover:text-stone-900 dark:hover:bg-stone-800 dark:hover:text-stone-100"
								aria-label="Sair"
								title="Sair"
							>
								<LogOut className="size-5" />
							</button>
						</div>
					) : (
						<>
							<NavLink to="/login" className={linkClass}>
								Entrar
							</NavLink>
							<Link
								to="/cadastro"
								className="rounded-lg bg-stone-900 px-3 py-2 text-sm font-semibold text-white hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-white"
							>
								Criar conta
							</Link>
						</>
					)}
				</div>

				<div className="flex items-center gap-1 md:hidden">
					{themeButton}
					<button
						type="button"
						onClick={() => setOpen((value) => !value)}
						className="rounded-lg p-2 hover:bg-stone-100 dark:hover:bg-stone-800"
						aria-label={open ? 'Fechar menu' : 'Abrir menu'}
						aria-expanded={open}
					>
						{open ? <X className="size-6" /> : <Menu className="size-6" />}
					</button>
				</div>
			</div>

			{open && (
				<nav className="border-t border-stone-200 px-4 py-3 md:hidden dark:border-stone-800">
					<div className="flex flex-col gap-1">
						{links.map((link) => (
							<NavLink
								key={link.to}
								to={link.to}
								end={link.end}
								className={linkClass}
								onClick={() => setOpen(false)}
							>
								{link.label}
							</NavLink>
						))}
						{user?.role === 'AUCTIONEER' && (
							<NavLink to="/painel/novo-lote" className={linkClass} onClick={() => setOpen(false)}>
								Novo lote
							</NavLink>
						)}
						{user?.role === 'BIDDER' && wallet && (
							<p className="px-3 py-2 text-sm text-stone-500">
								Disponível:{' '}
								<strong className="text-stone-900 dark:text-stone-100">
									{formatBRL(wallet.availableCents)}
								</strong>
							</p>
						)}
						<div className="mt-2 border-t border-stone-200 pt-2 dark:border-stone-800">
							{user ? (
								<button
									type="button"
									onClick={handleLogout}
									className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-stone-600 dark:text-stone-300"
								>
									<LogOut className="size-4" /> Sair ({user.name})
								</button>
							) : (
								<div className="flex gap-2">
									<NavLink to="/login" className={linkClass} onClick={() => setOpen(false)}>
										Entrar
									</NavLink>
									<NavLink to="/cadastro" className={linkClass} onClick={() => setOpen(false)}>
										Criar conta
									</NavLink>
								</div>
							)}
						</div>
					</div>
				</nav>
			)}
		</header>
	);
}
