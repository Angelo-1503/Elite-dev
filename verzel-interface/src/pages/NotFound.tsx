import Layout from '../components/layout/Layout';
import { ButtonLink } from '../components/ui/Button';

export default function NotFound() {
	return (
		<Layout>
			<div className="py-24 text-center">
				<p className="font-serif text-6xl font-semibold text-brand-600">404</p>
				<h1 className="mt-4 font-serif text-2xl font-semibold">Página não encontrada</h1>
				<ButtonLink to="/" variant="secondary" className="mt-6">
					Voltar para a vitrine
				</ButtonLink>
			</div>
		</Layout>
	);
}
