import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { WalletProvider } from './context/WalletContext';
import './index.css';

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<BrowserRouter>
			<ThemeProvider>
				<AuthProvider>
					<WalletProvider>
						<App />
						<Toaster
							position="top-right"
							containerStyle={{ top: 76 }}
							toastOptions={{
								className:
									'!bg-white !text-stone-800 dark:!bg-stone-800 dark:!text-stone-100 !text-sm',
							}}
						/>
					</WalletProvider>
				</AuthProvider>
			</ThemeProvider>
		</BrowserRouter>
	</StrictMode>,
);
