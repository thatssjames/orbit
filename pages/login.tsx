import { NextPage } from "next";
import { useForm, FormProvider, SubmitHandler } from 'react-hook-form';
import React, { useState } from "react";
import { loginState } from "@/state";
import { useRecoilState } from "recoil";
import Button from "@/components/button";
import Router from "next/router";
import axios from "axios";
import Input from "@/components/input";
import Link from "next/link";


type form = {
	username: string;
	password: string;
};

const Login: NextPage = ({ }) => {
	const methods = useForm<form>();
	const { register, handleSubmit, setError, formState: { errors } } = methods;

	const [loading, setLoading] = useState(false);
	const [login, setLogin] = useRecoilState(loginState);

	const onSubmit: SubmitHandler<form> = async (data) => {
		setLoading(true);
		let req;
		try {
			req = await axios.post('/api/auth/login', data)
		} catch (e: any) {
			setLoading(false);
			if (e.response.status === 404) {
				setError('username', { type: 'custom', message: e.response.data.error })
				return;
			}
			if (e.response.status === 401) {
				setError('username', { type: 'custom', message: e.response.data.error })
				setError('password', { type: 'custom', message: e.response.data.error })
				return;
			}
			setError('username', { type: 'custom', message: 'Something went wrong' })
			setError('password', { type: 'custom', message: 'Something went wrong' })
		} finally {
			if (!req) return;
			setLogin({
				...req?.data.user,
				workspaces: req?.data.workspaces,
			});
			Router.push('/')
			setLoading(false);
		}
	}
	return (
		<div className="flex bg-infobg-light dark:bg-infobg-dark h-screen bg-no-repeat bg-cover bg-center" >
			<div className=" bg-white dark:bg-gray-800 dark:bg-opacity-50 dark:backdrop-blur-lg w-11/12 sm:w-4/6 md:3/6 xl:w-5/12 mx-auto my-auto rounded-3xl p-6" 					>
				<div>
					<p className="font-bold text-2xl dark:text-white">👋 Welcome to Orbit</p>
					<p className="text-md text-gray-500 dark:text-gray-200">
						Login to your Orbit account to continue
					</p>

					<FormProvider {...methods}>
						<form className="mt-2 mb-8" onSubmit={handleSubmit(onSubmit)}>
							<Input label="Username" placeholder="Username" id="username" {...register("username", { required: { value: true, message: "This field is required" } })} />
							<Input label="Password" placeholder="Password" type="password" id="password" {...register("password", { required: { value: true, message: "This field is required" } })} />
							<div className="mt-2 text-left">
								<Link href="/forgot-password" className="text-sm text-blue-500 hover:underline">Forgot password?</Link>
							</div>
							<input type="submit" className="hidden" />
						</form>
					</FormProvider>

					<div className="flex">
						<Button
							onPress={() => Router.push("/signup")}
							classoverride="mr-auto ml-0"
							loading={loading}
						>
							Sign up
						</Button>

						<Button
							onPress={handleSubmit(onSubmit)}
							classoverride="ml-auto"
							loading={loading}
						>
							Continue
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
};

export default Login;