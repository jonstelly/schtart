<main>
	<p class="eyebrow">A fresh tab for what matters</p>
	<h1>Schtart<span>.</span></h1>
	<p class="intro">Your personal starting point for the day. Sports is just one part of what’s ahead.</p>
	<a class="status" href="/api/health">System status <span aria-hidden="true">↗</span></a>
</main>

<style>
	main {
		box-sizing: border-box;
		min-height: 100svh;
		display: grid;
		align-content: center;
		justify-items: start;
		padding: clamp(2rem, 8vw, 8rem);
		background: #f4f1e9;
		color: #1d2925;
		font-family: 'Avenir Next', Avenir, 'Segoe UI', sans-serif;
	}

	.eyebrow {
		margin: 0 0 1rem;
		color: #52685c;
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}

	h1 {
		margin: 0;
		font-family: Georgia, 'Times New Roman', serif;
		font-size: clamp(5rem, 18vw, 14rem);
		font-weight: 400;
		letter-spacing: -0.09em;
		line-height: 0.9;
	}

	h1 span {
		color: #dc633e;
	}

	.intro {
		max-width: 27rem;
		margin: 2rem 0;
		color: #526158;
		font-size: clamp(1.1rem, 2vw, 1.35rem);
		line-height: 1.6;
	}

	.status {
		color: #1d2925;
		font-size: 0.9rem;
		text-decoration-color: #dc633e;
		text-underline-offset: 0.3em;
	}

	.status span {
		margin-left: 0.35rem;
		color: #dc633e;
	}
</style>
