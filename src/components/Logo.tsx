interface Props {
  darkMode: boolean;
}

export default function Logo({ darkMode }: Props) {
  return (
    <div className="flex items-center gap-3 select-none">
      <div className="relative">
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl font-black transition-all duration-500 shadow-lg ${
            darkMode
              ? "bg-gradient-to-br from-violet-500 to-cyan-400 text-white shadow-violet-500/30"
              : "bg-gradient-to-br from-indigo-600 to-purple-500 text-white shadow-indigo-500/30"
          }`}
          style={{ fontFamily: "JetBrains Mono, monospace" }}
        >
          TF
        </div>
        <div
          className={`absolute -top-1 -right-1 w-3 h-3 rounded-full animate-ping ${
            darkMode ? "bg-cyan-400" : "bg-green-400"
          }`}
        />
        <div
          className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${
            darkMode ? "bg-cyan-400" : "bg-green-400"
          }`}
        />
      </div>
      <div>
        <h1
          className={`text-2xl font-extrabold tracking-tight leading-none transition-colors duration-300 ${
            darkMode
              ? "bg-gradient-to-r from-violet-400 to-cyan-300 bg-clip-text text-transparent"
              : "bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent"
          }`}
        >
          TypeFlow
        </h1>
        <p
          className={`text-[10px] font-medium tracking-widest uppercase transition-colors duration-300 ${
            darkMode ? "text-gray-500" : "text-gray-400"
          }`}
        >
          Speed • Accuracy • Flow
        </p>
      </div>
    </div>
  );
}
