import Image from "next/image";
import { Space_Mono } from "next/font/google";

const mainFont = Space_Mono({ weight: ["400", "700"], subsets: ["latin"] });

export default function Home() {
  return (
    <main className={`${mainFont.className} `}>
      <div className="extraShadow flex min-h-screen flex-col p-12 ">
        <Image
          src="/background.png"
          alt="Background image"
          className="object-cover object-center dark:invert transform tw-scale-x-1"
          fill
          priority
        />
      </div>
      <div className="flex min-h-screen flex-col p-12 ">
        <h1
          className={`${mainFont.className} mb-3 text-5xl font-700 text-white z-20`}
        >
          David Corbacho Román
        </h1>
        <br />
        <div>
          <span className={`uxEngineer text-2xl font-semibold text-white`}>
            UX Engineer
          </span>
          <br></br>
          <span
            className={`uxEngineer digital text-xl font-400 font-bold text-white`}
          >
            DIGITAL
          </span>
        </div>
        <div className={` bulletPoints mb-3 text-xl font-400 text-white z-20`}>
          <br />
          <br />
          <div className="shwoop-in"></div>
          <div className="shwoop-in"> ⭐️ He knows his stuff</div>
          <div className="shwoop-in">
            🎩 Motivated by helping others, speaker
          </div>
          <div className="shwoop-in"> 🇪🇸 Spanish expat in Finland 🇫🇮</div>
          <div className="shwoop-in">
            🇧🇻{" "}
            <a
              href="https://nordlys.studio"
              target="_blank"
              rel="noopener noreferrer"
            >
              nordlys.studio
            </a>{" "}
            • co-founder • remote
          </div>
        </div>

        <footer className={`mb-3 text-l font-400 text-white z-20`}>
          <div className="shwoop-bottom">
            |
            <a
              href="https://bsky.app/profile/dcor.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="shwoop-bottom"
            >
              Bluesky
            </a>
          </div>{" "}
          <div className="shwoop-bottom">
            |
            <a
              href="https://twitter.com/dcorbacho"
              target="_blank"
              rel="noopener noreferrer"
              className="shwoop-bottom"
            >
              Twitter
            </a>
          </div>{" "}
          <div className="shwoop-bottom">
            |
            <a
              href="https://www.linkedin.com/in/corbacho/"
              target="_blank"
              rel="noopener noreferrer"
              className="shwoop-bottom"
            >
              LinkedIn
            </a>
          </div>{" "}
          <div className="shwoop-bottom">
            |
            <a
              href="https://github.com/dcorb"
              target="_blank"
              rel="noopener noreferrer"
              className="shwoop-bottom"
            >
              Github
            </a>
          </div>
        </footer>
      </div>
    </main>
  );
}
