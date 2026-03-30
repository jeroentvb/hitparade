const MUSIC_WORDS = [
	'FUNK',
	'BASS',
	'BEAT',
	'DRUM',
	'JAZZ',
	'RIFF',
	'SOUL',
	'TUNE',
	'VIBE',
	'WAVE',
	'AMP',
	'CHORD',
	'DISC',
	'ECHO',
	'FUZZ',
	'GONG',
	'HARP',
	'KEYS',
	'LOOP',
	'LYRIC',
	'MASH',
	'NOTE',
	'PICK',
	'REED',
	'SYNC',
	'TAPE',
	'WAH',
	'ZAPP',
	'BOOM',
	'DROP'
];

export function generateJoinCode(activeGames: Map<string, unknown>): string {
	const maxAttempts = 100;
	for (let i = 0; i < maxAttempts; i++) {
		const word = MUSIC_WORDS[Math.floor(Math.random() * MUSIC_WORDS.length)];
		const num = String(Math.floor(Math.random() * 90) + 10);
		const code = `${word}-${num}`;
		if (!activeGames.has(code)) return code;
	}
	throw new Error('Failed to generate unique join code');
}
