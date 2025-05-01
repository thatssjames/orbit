'use client';

import { loginState } from '@/state';
import axios from 'axios';
import { useRouter } from 'next/router';
import { ReactNode, useEffect, useState } from 'react';
import { useRecoilState } from 'recoil';


export default function AuthProvider({
	loading,
	setLoading,
}: {
	loading: boolean;
	setLoading: React.Dispatch<React.SetStateAction<boolean>>;
}) {
	const [login, setLogin] = useRecoilState(loginState);
	const Router = useRouter();
  
	useEffect(() => {
		const checkLogin = async () => {
		  try {
			const req = await axios.get("/api/@me");
	
			// If request is successful and workspace is set up
			setLogin(req.data.user)
			setLoading(false);
		  } catch (err: any) {
			console.error("Login check error:", err.response?.data);
	
			// Handle errors based on response data
			if (err.response?.data.error === "Workspace not setup") {
			  // Redirect to the /welcome page
			  Router.push("/welcome");
			  setLoading(false);
			  return;
			}
	
			if (err.response?.data.error === "Not logged in") {
			  // Redirect to the /login page
			  Router.push("/login");
			  setLoading(false);
			  return;
			}
	
			// Handle other errors if needed
			setLoading(false);
		  }
		};
	
		checkLogin();
	  }, [setLoading, setLogin]);

  return <></>;
}
