# BASE JUMP 🚀

A fast-paced, addictive endless jumper game built natively for the [Base](https://base.org) ecosystem. Jump from platform to platform, avoid falling, and climb the global leaderboard!

## 🌟 Features

- **Blazing Fast Gameplay**: Super snappy physics tuned for 60FPS.
- **Base Native App**: Built as a Mini App that connects with your profile.
- **Global Leaderboard**: Uses Vercel KV / Upstash Redis to keep a real-time global top 20 score list.
- **Daily Streak**: Simple integrated daily check-ins to build your on-chain streak on Base.
- **Mobile Optimized**: Fully responsive with touch controls (tap left/right).
- **Keyboard Controls**: Complete support setup for desktop play (Arrow keys or A/D).

## 🛠 Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Styling**: Vanilla CSS Modules (No heavy frameworks, absolute performance)
- **Game Engine**: HTML5 Canvas with custom physics loop (`requestAnimationFrame`)
- **Database**: Vercel KV / Upstash Redis (For Leaderboard)

## 🎮 How to Play

- **Desktop**: Press `A` / `D` or `Left Arrow` / `Right Arrow` to move.
- **Mobile**: Tap and hold the left or right side of the screen.
- Bounce on the platforms to go higher. If you fall below the screen, it's game over!

## 📝 License

MIT
