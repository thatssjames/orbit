import { NextPage } from "next";
import React, { useState } from "react";
import { useForm, FormProvider } from "react-hook-form";
import axios from "axios";
import Router from "next/router";
import Slider from "@/components/slider";
import Input from "@/components/input";
import Button from "@/components/button";

type FormData = {
	username: string;
};

type ResetPasswordData = {
	password: string;
	verifypassword: string;
};

const ForgotPassword: NextPage = () => {
	const [selectedSlide, setSelectedSlide] = useState(0);
	const [code, setCode] = useState("");
	const [error, setError] = useState<string | null>(null);
	const usernameForm = useForm<FormData>();
	const passwordForm = useForm<ResetPasswordData>();

	const startReset = async () => {
		setError(null);
		try {
			const response = await axios.post("/api/auth/reset/start", {
				username: usernameForm.getValues("username"),
			});
			setCode(response.data.code);
			setSelectedSlide(1);
		} catch (e: any) {
			const msg = e?.response?.data?.error ?? "Something went wrong";
 			usernameForm.setError("username", { type: "manual", message: msg });
		}
	};

	const finishReset = async () => {
		setError(null);
		try {
			await axios.post("/api/auth/reset/finish", {
				password: passwordForm.getValues("password"),
			});
			Router.push("/");
		} catch (e: any) {
			const msg = e?.response?.data?.error ?? "Verification failed";
			setError(msg);
		}
	};

	return (
		<div className="flex bg-infobg-light dark:bg-infobg-dark h-screen bg-no-repeat bg-cover bg-center">
			<Slider activeSlide={selectedSlide}>
			<div>
				<p className="font-bold text-2xl dark:text-white">Forgot your password?</p>
				<p className="text-md text-gray-500 dark:text-gray-200">
					Enter your Roblox username to begin resetting your password.
				</p>
				<FormProvider {...usernameForm}>
					<form className="mb-8 mt-2" onSubmit={usernameForm.handleSubmit(startReset)}>
						<Input
							placeholder="Username"
							label="Username"
							id="username"
							{...usernameForm.register("username", {
							required: "This field is required",
							})}
						/>
					</form>
				</FormProvider>
				<Button onPress={usernameForm.handleSubmit(startReset)}>Continue</Button>
			</div>
			<div>
				<p className="font-bold text-2xl dark:text-white">Verify your Roblox account</p>
				<p className="text-md text-gray-500 dark:text-gray-200">
					Paste the below code into your Roblox profile blurb to prove ownership:
				</p>
				<p className="text-lg text-gray-500 dark:text-gray-200 text-center mt-4 leading-10">
					<code className="bg-gray-600 p-2 rounded-lg">{code}</code>
				</p>
				{error && (
					<p className="text-center mt-4">
						<span className="bg-red-600 p-2 mt-2 rounded-lg">{error}</span>
					</p>
				)}
				<div className="mt-7 flex">
					<Button classoverride="ml-auto" onPress={async () => { setError(null);
						try {
							const response = await axios.post("/api/auth/reset/verify");
							if (response.data.success) {
								setSelectedSlide(2);
							}
							} catch (e: any) {
							const msg = e?.response?.data?.error || "Verification failed";
							setError(msg);
							}
						}}>
						Verify
					</Button>
				</div>
			</div>
			<div>
				<p className="font-bold text-2xl dark:text-white">Set your new password</p>
				<p className="text-md text-gray-500 dark:text-gray-200">Enter and confirm your new password</p>
				<FormProvider {...passwordForm}>
					<form className="mb-8 mt-2" onSubmit={passwordForm.handleSubmit(finishReset)}>
						<Input type="password" {...passwordForm.register("password", { required: "You must enter a password", })} label="New Password"/>
						<Input type="password" {...passwordForm.register("verifypassword", { required: "Please confirm your password", validate: (value) => value === passwordForm.getValues("password") || "Passwords must match", })} label="Confirm Password"/>
					</form>
				</FormProvider>
				{error && (
					<p className="text-center mt-4">
						<span className="bg-red-600 p-2 mt-2 rounded-lg">{error}</span>
					</p>
				)}
				<div className="mt-7 flex">
					<Button onPress={() => setSelectedSlide(1)} classoverride="ml-0 mr-auto"> Back </Button>
					<Button onPress={passwordForm.handleSubmit(finishReset)}>Reset Password</Button>
				</div>
			</div>
		</Slider>
	</div>
	);
};

export default ForgotPassword;
