import NodeCache from "node-cache";
import * as noblox from 'noblox.js'
import { getRobloxUsername, getRobloxThumbnail, getRobloxDisplayName } from "@/utils/roblox";

const usernames = new NodeCache();           // No expiry
const thumbnails = new NodeCache();          // Thumbnail cache
const displaynames = new NodeCache();        // No expiry
const thumbnailCooldown = new NodeCache();   // Cooldown tracker

export async function getUsername(userId: number | bigint) {
	const cachedUsername = usernames.get(Number(userId));
	if (cachedUsername) {
		return cachedUsername as string;
	} else {
		const username = await getRobloxUsername(Number(userId));
		usernames.set(Number(userId), username);
		return username as string;
	}
}

/** 
 * Returns a cached thumbnail or fresh thumbnail if not cached and not rate-limited
 * Cooldown: 5 seconds per user to avoid API spam
 */
export async function getThumbnail(userId: number | bigint): Promise<string> {
	const id = Number(userId);
	const cachedThumbnail = thumbnails.get(id);
	const isCoolingDown = thumbnailCooldown.get(id);

	if (cachedThumbnail && isCoolingDown) {
		return cachedThumbnail as string;
	}

	if (isCoolingDown) {
		// Skip fetch to respect cooldown, fallback to cached or default image
		return cachedThumbnail as string || `https://www.roblox.com/headshot-thumbnail/image?userId=${id}&width=420&height=420&format=png`;
	}

	try {
		const thumbnail = await getRobloxThumbnail(id);
		thumbnails.set(id, thumbnail);
		thumbnailCooldown.set(id, true, 2000); // 2 seconds cooldown
		return thumbnail || `https://www.roblox.com/headshot-thumbnail/image?userId=${id}&width=420&height=420&format=png`;
	} catch (e) {
		console.warn(`Failed to fetch thumbnail for ${id}:`, e);
		return cachedThumbnail as string || `https://www.roblox.com/headshot-thumbnail/image?userId=${id}&width=420&height=420&format=png`;
	}
}

export async function getDisplayName(userId: number | bigint): Promise<string> {
	const cachedDisplayName = displaynames.get(Number(userId));
	if (cachedDisplayName) {
		return cachedDisplayName as string;
	} else {
		const displayName = await getRobloxDisplayName(Number(userId));
		displaynames.set(Number(userId), displayName);
		return displayName as string;
	}
}

export { getRobloxUsername };