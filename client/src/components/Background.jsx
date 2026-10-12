// Gradient + floating blurred blobs behind everything: this is what makes the glass panels look like glass
export default function Background() {
  return (
    <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden bg-gradient-to-br from-rose-100 via-violet-50 to-sky-100 transition-colors duration-500 dark:from-[#0b0716] dark:via-[#140a2b] dark:to-[#06101f]">
      <div className="absolute -left-24 -top-24 h-[28rem] w-[28rem] animate-blob rounded-full bg-rose-400/40 blur-3xl dark:bg-rose-600/25" />
      <div className="absolute -right-24 top-1/4 h-[30rem] w-[30rem] animate-blob rounded-full bg-violet-400/40 blur-3xl [animation-delay:-7s] dark:bg-violet-700/30" />
      <div className="absolute -bottom-32 left-1/3 h-[26rem] w-[26rem] animate-blob rounded-full bg-sky-400/40 blur-3xl [animation-delay:-13s] dark:bg-cyan-700/20" />
    </div>
  );
}
