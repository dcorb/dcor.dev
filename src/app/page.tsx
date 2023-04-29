import Image from "next/image";
import { Merriweather } from "next/font/google";

const mainFont = Merriweather({ weight: ["400", "700"], subsets: ["latin"] });

export default function Home() {
  return (
    <main className="bodybg">
      <Image
        src="/bg.svg"
        alt="Background image"
        className="object-cover object-center dark:invert transform tw-scale-x-1"
        fill
        priority
        style={{ transform: "scaleX(-1)" }}
      />

      <div className="flex min-h-screen flex-col p-12 ">
        <h1
          className={`${mainFont.className} mb-3 text-6xl font-700 text-white z-20`}
        >
          David Corbacho Román
        </h1>
        <p
          className={`${mainFont.className} mb-3 text-xl font-400 text-white z-20`}
        >
          <br />
          「　UX Engineer　」
          <br />
          <br /> ⭐️ Motivated by helping others, speaker
          <br /> 🇪🇸 Spanish expat in Finland 🇫🇮
          <br /> 🇧🇻{" "}
          <a
            href="https://nordlys.studio"
            target="_blank"
            rel="noopener noreferrer"
          >
            nordlys.studio
          </a>{" "}
          • happy remote
          <br /> 🟦 dcor.bsky.social
          <br /> 🐦 @dcorbacho
        </p>
      </div>
    </main>
  );
}
