import { Route, Routes } from 'react-router-dom';
import Audit from './pages/Audit';
import CreateLot from './pages/CreateLot';
import Login from './pages/Login';
import LotRoom from './pages/LotRoom';
import MyBids from './pages/MyBids';
import NotFound from './pages/NotFound';
import Receipt from './pages/Receipt';
import Register from './pages/Register';
import SellerDashboard from './pages/SellerDashboard';
import Showcase from './pages/Showcase';
import Wallet from './pages/Wallet';
import PrivateRoute from './routes/PrivateRoute';

function App() {
	return (
		<Routes>
			{/* Públicas */}
			<Route path="/" element={<Showcase />} />
			<Route path="/lotes/:id" element={<LotRoom />} />
			<Route path="/auditoria/:lotId" element={<Audit />} />
			<Route path="/comprovantes/:id" element={<Receipt />} />
			<Route path="/login" element={<Login />} />
			<Route path="/cadastro" element={<Register />} />

			{/* Licitante */}
			<Route
				path="/carteira"
				element={
					<PrivateRoute requiredRole="BIDDER">
						<Wallet />
					</PrivateRoute>
				}
			/>
			<Route
				path="/meus-lances"
				element={
					<PrivateRoute requiredRole="BIDDER">
						<MyBids />
					</PrivateRoute>
				}
			/>

			{/* Leiloeiro */}
			<Route
				path="/painel"
				element={
					<PrivateRoute requiredRole="AUCTIONEER">
						<SellerDashboard />
					</PrivateRoute>
				}
			/>
			<Route
				path="/painel/novo-lote"
				element={
					<PrivateRoute requiredRole="AUCTIONEER">
						<CreateLot />
					</PrivateRoute>
				}
			/>

			<Route path="*" element={<NotFound />} />
		</Routes>
	);
}

export default App;
