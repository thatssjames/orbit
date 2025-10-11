const randomTextFromArray = (texts: string[]) => texts[Math.floor(Math.random() * texts.length)];

const randomText = (name: string) => {
	const now = new Date();
	const month = now.getMonth();
	const day = now.getDate();
	const isHalloweenSeason = month === 9; // HW 
	const isHalloweenDay = isHalloweenSeason && day === 31; // HW

	const morningOnlyBase = [
		`Good morning, ${name} ☀️`,
		`Top of the morning to you, ${name}! 🥐`,
		`Rise and shine, ${name} 🌅`,
		`Hope you slept well, ${name} 😴`,
		`Morning, ${name}. Ready to take on the day? 💪`,
		`Hey ${name}, coffee's brewing! ☕️`,
		`Rise and grind, ${name} 🏋️‍♂️`,
		`New day, new opportunities, ${name} 🌄`,
		`The early bird gets the worm, ${name} 🐦`,
		`Boot sequence complete, ${name}. Let’s launch 🚀`,
		`Up and at 'em, ${name}! 🐓`,
		`Let’s make today awesome, ${name} 💫`,
		`First light and first coffee, right ${name}? ☕️`,
		`It’s go time, ${name} 🔥`,
		`Sun’s out, ambition’s up, ${name} 😎`,
		`Time to shine, ${name} ✨`,
		`New day, new tasks — let’s crush them, ${name} ✅`,
		`Hello sunshine! ${name}, you’re glowing today ☀️`,
		`Mission log: ${name} is online and operational 🛰️`,
		`Don't just wake up, show up — let’s go ${name} 💼`
	];

	const afternoonOnlyBase = [
		`Good afternoon, ${name} 🌞`,
		`Hope your day is going well, ${name} 😊`,
		`Hey ${name}, how’s your day so far? 🕑`,
		`You're halfway through, ${name}! 🧭`,
		`Keep up the great work, ${name} 👏`,
		`Hello there, ${name} 👋`,
		`A productive afternoon to you, ${name} 🛠️`,
		`Let’s power through the afternoon, ${name} ⚡️`,
		`Still going strong, ${name}? 🔋`,
		`Orbit stabilizing… productivity at peak, ${name} 🌑`,
		`Need a snack break, ${name}? 🍎`,
		`Still on track, ${name}? You're killing it 🧨`,
		`Let’s turn that to-do list into a done list, ${name} ✅`,
		`You've got this, ${name}. One hour at a time ⏳`,
		`Ping! Just checking in on you, ${name} 🛎️`,
		`Think of this message as your mid-day high-five 🖐️`,
		`Orbit’s still spinning and so are you, ${name} 🌀`,
		`Don't forget to hydrate, ${name} 💧`,
		`Productivity levels: Rising steadily, Captain ${name} 📈`,
		`It’s a good day to get stuff done, ${name} 🧠`
	];

	const nightOnlyBase = [
		`Good evening, ${name} 🌙`,
		`Winding down, ${name}? 🛋️`,
		`Hope your day went well, ${name} 🌆`,
		`Relax, you’ve earned it, ${name} 😌`,
		`Evening vibes, ${name} ✨`,
		`Time to slow down and reflect, ${name} 🧘`,
		`The stars are out, ${name} ⭐️`,
		`Great job today, ${name} 🙌`,
		`Sweet dreams in advance, ${name} 😴`,
		`Orbit doesn’t sleep — but you should soon, ${name} 💤`,
		`The night is calm, ${name}. Time to relax 🌌`,
		`Logging off soon, ${name}? You’ve earned it 📴`,
		`Recharge mode: Initiated for ${name} 🔋`,
		`Even stars need rest — so do you, ${name} 🌟`,
		`Thanks for showing up today, ${name} 💙`,
		`Night shift or night chill? You decide, ${name} 🌃`,
		`May your dreams be bug-free, ${name} 🐛💤`,
		`Another day complete. Well played, ${name} 🎮`,
		`Captain ${name}, mission complete for today 🚀`,
		`Sending good energy for tomorrow, ${name} 🔮`
	];

	const lateNightBase = [
		`Still awake, ${name}? Respect 🌙`,
		`The grind never sleeps — neither do you, huh ${name}? 😅`,
		`Late-night coding or existential scrolling, ${name}? 💻📱`,
		`You, me, and the moon. Let’s vibe, ${name} 🌕`,
		`Insomniacs anonymous: Welcome, ${name} 😴💤`,
		`Hope you're doing okay, ${name}. Remember to rest soon 🫶`
	];

	const morningHalloween = [
		`Ghoul morning, ${name} 🎃`,
		`Rise & fright, ${name}! 👻`,
		`Witching you a productive dawn, ${name} 🧙‍♀️`,
		`First brew of the day or potion, ${name}? 🧪☕️`,
		`Pumpkin-powered focus today, ${name} 🎃⚡️`,
		`Creepin’ into the day with you, ${name} 🕷️`,
		`Boot sequence from the crypt complete, ${name} 🪦`,
		`No tricks — just tasks to conquer, ${name} ✅`,
		`Orbit control reports: zero haunt anomalies, ${name} 🛰️`,
		`Let’s conjure some progress, ${name} ✨`
	];

	const afternoonHalloween = [
		`Hallow-afternoon, ${name} 🦇`,
		`Midday spirits approve your grind, ${name} 👻`,
		`Still brewing momentum, ${name}? 🧪`,
		`Cauldron simmering — keep stirring those tasks, ${name} 🫕`,
		`You’re slaying, ${name} 🗡️`,
		`Orbit shields holding vs spectral interference, ${name} 🛡️`,
		`Snack idea: pumpkin byte? ${name} 🎃`,
		`Cobweb-free workflow detected, ${name} 🕸️`,
		`Enchanting productivity aura today, ${name} ✨`,
		`No jump scares — just commits, ${name} 💾`
	];

	const nightHalloween = [
		`Good eeee-vening, ${name} 🦇`,
		`Moonlit focus mode engaged, ${name} 🌕`,
		`Shadows are long, your checklist short, ${name} ✅`,
		`Great work — the restless spirits applaud, ${name} 👻👏`,
		`Time to vanish into the mist soon, ${name} 🌫️`,
		`Orbit lanterns lit for you, ${name} 🏮`,
		`Bats returning to roost — you too soon, ${name}? 🦇`,
		`Potion cooldown initiated, ${name} 🧪`,
		`Haunt level dropping — rest up, ${name} 😴`,
		`Crypt secured. Mission logged, ${name} 🪦`
	];

	const lateNightHalloween = [
		`Past the witching hour, ${name}? 🔮`,
		`Midnight mantling complete, ${name} 🌑`,
		`The castle torches burn low, ${name} 🕯️`,
		`Skeleton crew shift detected — that’s you, ${name} 💀`,
		`Ensure your soul (and code) stays intact, ${name} 👻`,
		`Consider resting before the pumpkins expire, ${name} 🎃`
	];

	const intensify = <T,>(arr: T[], seasonal: T[]) => (isHalloweenDay ? [...seasonal, ...arr] : seasonal);
	const morningSet = isHalloweenSeason ? intensify(morningOnlyBase, morningHalloween) : morningOnlyBase;
	const afternoonSet = isHalloweenSeason ? intensify(afternoonOnlyBase, afternoonHalloween) : afternoonOnlyBase;
	const nightSet = isHalloweenSeason ? intensify(nightOnlyBase, nightHalloween) : nightOnlyBase;
	const lateNightSet = isHalloweenSeason ? intensify(lateNightBase, lateNightHalloween) : lateNightBase;
	const hour = now.getHours();

	if (hour >= 20) return randomTextFromArray(nightSet);
	if (hour >= 12) return randomTextFromArray(afternoonSet);
	if (hour >= 4) return randomTextFromArray(morningSet);
	return randomTextFromArray(lateNightSet);
};

export default randomText;
