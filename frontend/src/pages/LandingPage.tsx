import { useMemo } from 'react';

const DEFAULT_DEV_LANDING_URL = 'http://localhost:8080';
const DEFAULT_PROD_LANDING_URL = '/landing-site/';

export default function LandingPage() {
	const landingUrl = useMemo(() => {
		const configuredUrl = import.meta.env.VITE_LANDING_APP_URL?.trim();
		if (configuredUrl) {
			if (import.meta.env.PROD && /localhost|127\.0\.0\.1/i.test(configuredUrl)) {
				return DEFAULT_PROD_LANDING_URL;
			}
			return configuredUrl;
		}
		return import.meta.env.PROD ? DEFAULT_PROD_LANDING_URL : DEFAULT_DEV_LANDING_URL;
	}, []);

	const iframeSrc = useMemo(() => {
		try {
			const url = new URL(landingUrl, window.location.origin);
			url.searchParams.set('mainAppUrl', window.location.origin);
			return url.toString();
		} catch {
			return landingUrl;
		}
	}, [landingUrl]);

	return (
		<div className="h-screen w-screen bg-white">
			<iframe
				key={iframeSrc}
				title="Landing frontend"
				src={iframeSrc}
				className="h-full w-full border-0"
			/>
		</div>
	);
}
