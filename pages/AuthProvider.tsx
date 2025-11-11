"use client";

import { loginState, workspacestate } from '@/state';
import axios from 'axios';
import { useRouter } from 'next/router';
import { useEffect, useRef } from 'react';
import { useRecoilState } from 'recoil';

const INTERCOM_APP_ID = process.env.NEXT_PUBLIC_INTERCOM_APP_ID;
const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.posthog.com';

export default function AuthProvider({
	loading,
	setLoading,
}: {
	loading: boolean;
	setLoading: React.Dispatch<React.SetStateAction<boolean>>;
}) {
	const [login, setLogin] = useRecoilState(loginState);
	const [workspace] = useRecoilState(workspacestate);
	const Router = useRouter();
	const posthogRef = useRef<any>(null);

	useEffect(() => {
		const checkLogin = async () => {
			try {
				const req = await axios.get('/api/@me');
				setLogin(req.data.user);
				setLoading(false);
			} catch (err: any) {
				console.error('Login check error:', err.response?.data);
				if (err.response?.data.error === 'Workspace not setup') {
					Router.push('/welcome');
					setLoading(false);
					return;
				}
				if (err.response?.data.error === 'Not logged in') {
					Router.push('/login');
					setLoading(false);
					return;
				}
				setLoading(false);
			}
		};

		checkLogin();
	}, [setLoading, setLogin]);

	useEffect(() => {
		if (!POSTHOG_KEY) return;

		let mounted = true;
		(async () => {
			try {
				const posthog = (await import('posthog-js')).default;
				if (!mounted) return;
				posthog.init(POSTHOG_KEY as string, { api_host: POSTHOG_HOST });
				posthogRef.current = posthog;
				if (login && posthogRef.current) {
					try {
						posthogRef.current.identify(String(login.username), {
							userid: String(login.userId),
							username: login.username,
							workspaceId: workspace?.groupId ?? null,
							avatar: `${window.location.origin}/avatars/${login.userId}.png`,
						});
					} catch (e) {
						// blah blah
					}
				}
			} catch (e) {
				// blah blah
			}
		})();

		return () => {
			mounted = false;
			try {
				posthogRef.current?.reset();
			} catch (e) {}
		};
	}, []);

	useEffect(() => {
		const isWelcomeOrLogin = Router.pathname === '/welcome' || Router.pathname === '/login';

		if (INTERCOM_APP_ID) {
			const injectIntercom = () => {
				if (document.getElementById('intercom-script')) return;
				const s = document.createElement('script');
				s.id = 'intercom-script';
				s.src = `https://widget.intercom.io/widget/${INTERCOM_APP_ID}`;
				s.async = true;
				document.head.appendChild(s);
			};

			(async () => {
				try {
					const cfgResp = await fetch('/api/intercom/config');
					const cfg = cfgResp.ok ? await cfgResp.json() : { configured: false };
					if (!cfg.configured) {
						console.warn('Intercom server-side JWT not configured; skipping Intercom load.');
						return;
					}

					injectIntercom();
					const ic = (window as any).Intercom;
					if (ic) ic('shutdown');

					if (isWelcomeOrLogin || !login) {
						const bootGuest = () => {
							try {
								(window as any).Intercom('boot', { app_id: INTERCOM_APP_ID });
							} catch (e) {
								// ignore
							}
						};

						if ((window as any).Intercom) bootGuest();
						else if (document.getElementById('intercom-script')) {
							document.getElementById('intercom-script')!.addEventListener('load', bootGuest);
						}
					} else if (login) {
						const avatar = `${window.location.origin}/avatars/${login.userId}.png`;
						const payload: any = {
							app_id: INTERCOM_APP_ID,
							name: login.username,
							user_id: String(login.userId),
							avatar: { type: 'image', image_url: avatar },
							custom_attributes: { workspaceId: workspace?.groupId ?? null },
						};

						const bootUser = () => {
							try {
								(window as any).Intercom('boot', payload);
							} catch (e) {
								// ignore
							}
						};

						try {
							const r = await fetch('/api/intercom/token', { credentials: 'same-origin' });
							if (r.ok) {
								const j = await r.json();
								if (j.intercom_user_jwt) {
									payload.intercom_user_jwt = j.intercom_user_jwt;
								} else {
									console.warn('Intercom token endpoint did not return a JWT');
								}
							} else {
								try {
									const err = await r.json();
									console.warn('Intercom token endpoint returned error:', err);
								} catch (e) {}
							}
						} catch (e) {
							console.warn('Failed to fetch intercom token:', e);
						}

						if ((window as any).Intercom) bootUser();
						else if (document.getElementById('intercom-script')) {
							document.getElementById('intercom-script')!.addEventListener('load', bootUser);
						}
					}
				} catch (e) {
					console.error('Intercom init error', e);
				}
			})();
		}

		try {
			const ph = posthogRef.current;
			if (ph) {
				if (login) {
					try {
						ph.identify(String(login.username), {
							userid: String(login.userId),
							username: login.username,
							workspaceId: workspace?.groupId ?? null,
							avatar: `${window.location.origin}/avatars/${login.userId}.png`,
						});
					} catch (e) {
						console.error('PostHog identify error:', e);
					}
				} else {
					try {
						ph.reset();
					} catch (e) {}
				}
			}
		} catch (e) {
			console.error('PostHog identify error', e);
		}

	}, [Router.pathname, login, workspace]);

	return <></>;
}
