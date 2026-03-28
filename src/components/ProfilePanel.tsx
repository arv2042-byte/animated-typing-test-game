import { useMemo, useState } from "react";
import { useAuth, type PerformanceRecord } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";

type AuthMode = "login" | "register" | "google";

const isTypingRecord = (
  record: PerformanceRecord
): record is Extract<PerformanceRecord, { type: "typing" }> =>
  record.type === "typing";

const isArrowRecord = (
  record: PerformanceRecord
): record is Extract<PerformanceRecord, { type: "arrow" }> =>
  record.type === "arrow";

export default function ProfilePanel() {
  const { settings } = useSettings();
  const dm = settings.darkMode;
  const {
    user,
    isAuthenticated,
    googleOAuthReady,
    records,
    registerLocal,
    loginLocal,
    loginGoogleLike,
    loginWithGoogleOAuth,
    logout,
    updateProfile,
    deleteAccount,
  } = useAuth();

  const [open, setOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [statusMsg, setStatusMsg] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [gmail, setGmail] = useState("");
  const [googleName, setGoogleName] = useState("");
  const [googlePhoto, setGooglePhoto] = useState("");

  const [profileName, setProfileName] = useState("");
  const [profilePhoto, setProfilePhoto] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const typingRecords = useMemo(
    () => records.filter(isTypingRecord),
    [records]
  );
  const arrowRecords = useMemo(
    () => records.filter(isArrowRecord),
    [records]
  );

  const metrics = useMemo(() => {
    const totalSessions = records.length;
    const avgWpm =
      typingRecords.length > 0
        ? Math.round(
            typingRecords.reduce((sum, item) => sum + item.wpm, 0) / typingRecords.length
          )
        : 0;
    const bestWpm =
      typingRecords.length > 0
        ? Math.max(...typingRecords.map((item) => item.wpm))
        : 0;
    const avgTypingAccuracy =
      typingRecords.length > 0
        ? Math.round(
            typingRecords.reduce((sum, item) => sum + item.accuracy, 0) /
              typingRecords.length
          )
        : 0;
    const avgArrowScore =
      arrowRecords.length > 0
        ? Math.round(
            arrowRecords.reduce((sum, item) => sum + item.score, 0) / arrowRecords.length
          )
        : 0;

    return {
      totalSessions,
      avgWpm,
      bestWpm,
      avgTypingAccuracy,
      avgArrowScore,
    };
  }, [arrowRecords, records.length, typingRecords]);

  const chartPoints = useMemo(() => {
    const recent = typingRecords.slice(-20);
    if (recent.length === 0) return "";
    const maxWpm = Math.max(...recent.map((r) => r.wpm), 30);
    const minWpm = Math.min(...recent.map((r) => r.wpm), 0);
    return recent
      .map((r, idx) => {
        const x = recent.length === 1 ? 150 : (idx / (recent.length - 1)) * 300;
        const y = 100 - ((r.wpm - minWpm) / Math.max(maxWpm - minWpm, 1)) * 90;
        return `${x},${y}`;
      })
      .join(" ");
  }, [typingRecords]);

  const handleOpen = () => {
    setOpen(true);
    setStatusMsg("");
    if (user) {
      setProfileName(user.name);
      setProfilePhoto(user.photoUrl || "");
    }
  };

  const handleImageUpload = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setStatusMsg("Please upload an image file.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setStatusMsg("Image must be under 2MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const value = typeof reader.result === "string" ? reader.result : "";
      setProfilePhoto(value);
    };
    reader.readAsDataURL(file);
  };

  const handleRegister = async () => {
    setIsBusy(true);
    const result = await registerLocal({ name, email, password });
    setIsBusy(false);
    setStatusMsg(result.message);
    if (result.ok) {
      setName("");
      setEmail("");
      setPassword("");
      setProfileName((name || "").trim());
    }
  };

  const handleLogin = async () => {
    setIsBusy(true);
    const result = await loginLocal({ email, password });
    setIsBusy(false);
    setStatusMsg(result.message);
    if (result.ok) {
      setPassword("");
      setProfileName("");
      setProfilePhoto("");
    }
  };

  const handleGoogle = async () => {
    setIsBusy(true);
    const result = googleOAuthReady
      ? await loginWithGoogleOAuth()
      : await loginGoogleLike({
          name: googleName,
          gmail,
          photoUrl: googlePhoto,
        });
    setIsBusy(false);
    setStatusMsg(result.message);
    if (result.ok) {
      setGmail("");
      setGoogleName("");
      setGooglePhoto("");
    }
  };

  const handleProfileSave = () => {
    const result = updateProfile({
      name: profileName,
      photoUrl: profilePhoto,
    });
    setStatusMsg(result.message);
  };

  const handleDelete = async () => {
    setIsBusy(true);
    const result = await deleteAccount(deleteConfirm);
    setIsBusy(false);
    setStatusMsg(result.message);
    if (result.ok) {
      setDeleteConfirm("");
      setOpen(false);
    }
  };

  const passwordStrength = useMemo(() => {
    let score = 0;
    if (password.length >= 10) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[a-z]/.test(password)) score += 1;
    if (/\d/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    return score;
  }, [password]);

  return (
    <>
      <button
        onClick={handleOpen}
        className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 ${
          dm
            ? "bg-gray-800/80 border border-gray-700/50 hover:border-cyan-500/50"
            : "bg-white/80 border border-gray-200 hover:border-blue-300 shadow-sm"
        }`}
        title="Profile"
      >
        {user?.photoUrl ? (
          <img src={user.photoUrl} alt="User" className="w-8 h-8 rounded-lg object-cover" />
        ) : (
          <svg className={`w-5 h-5 ${dm ? "text-gray-300" : "text-gray-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.121 17.804A9.955 9.955 0 0112 15c2.21 0 4.252.714 5.879 1.924M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
          </svg>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
      )}

      <div
        className={`fixed top-0 left-0 z-[101] h-dvh w-full max-w-md transition-transform duration-500 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div
          className={`h-dvh overflow-y-auto overscroll-contain px-6 py-6 pb-24 ${
            dm ? "bg-gray-900/98 border-r border-white/10" : "bg-white/98 border-r border-gray-200"
          }`}
          style={{ backdropFilter: "blur(20px)" }}
        >
          <div className="sticky top-0 z-10 -mx-6 px-6 pb-5 mb-6 pt-1 backdrop-blur-xl bg-inherit border-b border-dashed border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <h2 className={`text-xl font-black ${dm ? "text-white" : "text-gray-800"}`}>Profile</h2>
                <p className={`text-xs ${dm ? "text-gray-500" : "text-gray-400"}`}>
                  {isAuthenticated ? "Account and performance" : "Login to save performance"}
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:scale-110 ${
                  dm ? "bg-gray-800 text-gray-400 hover:text-white" : "bg-gray-100 text-gray-500 hover:text-gray-800"
                }`}
              >
                x
              </button>
            </div>
          </div>

          {!isAuthenticated ? (
            <div className="space-y-5">
              <div className={`flex p-1 rounded-lg ${dm ? "bg-gray-800" : "bg-gray-100"}`}>
                <AuthTab label="Login" active={authMode === "login"} onClick={() => setAuthMode("login")} dm={dm} />
                <AuthTab label="Register" active={authMode === "register"} onClick={() => setAuthMode("register")} dm={dm} />
                <AuthTab label="Google" active={authMode === "google"} onClick={() => setAuthMode("google")} dm={dm} />
              </div>

              {authMode !== "google" && (
                <>
                  {authMode === "register" && (
                    <InputField label="Name" value={name} onChange={setName} dm={dm} placeholder="Your full name" />
                  )}
                  <InputField
                    label="Email"
                    value={email}
                    onChange={setEmail}
                    dm={dm}
                    placeholder="you@example.com"
                    type="email"
                  />
                  <InputField
                    label="Password"
                    value={password}
                    onChange={setPassword}
                    dm={dm}
                    placeholder="Enter password"
                    type="password"
                  />

                  {authMode === "register" && (
                    <div>
                      <div className={`h-2 rounded-full ${dm ? "bg-gray-800" : "bg-gray-200"}`}>
                        <div
                          className={`h-2 rounded-full transition-all ${
                            passwordStrength >= 4
                              ? "bg-emerald-500"
                              : passwordStrength >= 3
                              ? "bg-amber-500"
                              : "bg-red-500"
                          }`}
                          style={{ width: `${(passwordStrength / 5) * 100}%` }}
                        />
                      </div>
                      <p className={`mt-1 text-xs ${dm ? "text-gray-500" : "text-gray-500"}`}>
                        Password leak protection enabled: common weak passwords are blocked.
                      </p>
                    </div>
                  )}

                  <button
                    disabled={isBusy}
                    onClick={authMode === "register" ? handleRegister : handleLogin}
                    className={`w-full py-3 rounded-xl font-bold text-white transition-all ${
                      isBusy
                        ? "opacity-60 cursor-not-allowed bg-gray-500"
                        : authMode === "register"
                        ? "bg-gradient-to-r from-indigo-600 to-violet-500"
                        : "bg-gradient-to-r from-blue-600 to-cyan-500"
                    }`}
                  >
                    {isBusy
                      ? "Please wait..."
                      : authMode === "register"
                      ? "Create Secure Account"
                      : "Login"}
                  </button>
                </>
              )}

              {authMode === "google" && (
                <>
                  <button
                    disabled={isBusy}
                    onClick={handleGoogle}
                    className={`w-full py-3 rounded-xl font-bold text-white transition-all ${
                      isBusy
                        ? "opacity-60 cursor-not-allowed bg-gray-500"
                        : "bg-gradient-to-r from-red-600 to-amber-500"
                    }`}
                  >
                    {isBusy
                      ? "Connecting..."
                      : googleOAuthReady
                      ? "Sign In with Google"
                      : "Connect Gmail Profile"}
                  </button>

                  {googleOAuthReady ? (
                    <p className={`text-xs ${dm ? "text-gray-500" : "text-gray-500"}`}>
                      Secure popup login is active via Firebase Authentication.
                    </p>
                  ) : (
                    <>
                      <InputField
                        label="Gmail"
                        value={gmail}
                        onChange={setGmail}
                        dm={dm}
                        placeholder="yourname@gmail.com"
                        type="email"
                      />
                      <InputField
                        label="Display Name"
                        value={googleName}
                        onChange={setGoogleName}
                        dm={dm}
                        placeholder="Optional"
                      />
                      <InputField
                        label="Photo URL"
                        value={googlePhoto}
                        onChange={setGooglePhoto}
                        dm={dm}
                        placeholder="https://..."
                      />
                      <p className={`text-xs ${dm ? "text-gray-500" : "text-gray-500"}`}>
                        Add Firebase env values to enable one-click Google OAuth popup sign-in.
                      </p>
                    </>
                  )}

                  <p className={`text-xs ${dm ? "text-gray-500" : "text-gray-500"}`}>
                    Password leak protection is enabled for local accounts using breach checks and
                    strong-password rules.
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <div className={`p-4 rounded-2xl ${dm ? "bg-gray-800/70 border border-gray-700" : "bg-gray-50 border border-gray-200"}`}>
                <div className="flex items-center gap-3">
                  {profilePhoto || user?.photoUrl ? (
                    <img
                      src={profilePhoto || user?.photoUrl}
                      alt="Profile"
                      className="w-16 h-16 rounded-xl object-cover border border-white/10"
                    />
                  ) : (
                    <div className={`w-16 h-16 rounded-xl flex items-center justify-center text-xl ${dm ? "bg-gray-700 text-gray-200" : "bg-white text-gray-700"}`}>
                      {(user?.name?.[0] || "U").toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className={`font-black text-lg ${dm ? "text-white" : "text-gray-800"}`}>{user?.name}</p>
                    <p className={`text-sm ${dm ? "text-gray-400" : "text-gray-500"}`}>{user?.email}</p>
                    <p className={`text-xs uppercase tracking-wider ${dm ? "text-cyan-400" : "text-indigo-600"}`}>
                      {user?.provider} account
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <InputField
                  label="Display Name"
                  value={profileName}
                  onChange={setProfileName}
                  dm={dm}
                  placeholder="Your name"
                />
                <label className="block">
                  <span className={`text-xs font-semibold uppercase tracking-wider ${dm ? "text-gray-400" : "text-gray-500"}`}>
                    Profile Photo
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e.target.files?.[0] || null)}
                    className={`mt-1 block w-full text-sm ${dm ? "text-gray-300" : "text-gray-700"}`}
                  />
                </label>
                <button
                  onClick={handleProfileSave}
                  className="w-full py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-500"
                >
                  Save Profile Changes
                </button>
                <button
                  onClick={logout}
                  className={`w-full py-2.5 rounded-xl font-bold ${
                    dm ? "bg-gray-800 text-gray-200 border border-gray-700" : "bg-gray-100 text-gray-700 border border-gray-200"
                  }`}
                >
                  Logout
                </button>
              </div>

              <div className={`p-4 rounded-2xl ${dm ? "bg-gray-800/70 border border-gray-700" : "bg-gray-50 border border-gray-200"}`}>
                <p className={`text-sm font-black mb-3 ${dm ? "text-white" : "text-gray-800"}`}>Performance Record</p>
                <div className="grid grid-cols-2 gap-3">
                  <MetricCard label="Sessions" value={metrics.totalSessions.toString()} dm={dm} />
                  <MetricCard label="Avg WPM" value={metrics.avgWpm.toString()} dm={dm} />
                  <MetricCard label="Best WPM" value={metrics.bestWpm.toString()} dm={dm} />
                  <MetricCard label="Typing Accuracy" value={`${metrics.avgTypingAccuracy}%`} dm={dm} />
                  <MetricCard label="Avg Arrow Score" value={metrics.avgArrowScore.toString()} dm={dm} />
                </div>
              </div>

              <div className={`p-4 rounded-2xl ${dm ? "bg-gray-800/70 border border-gray-700" : "bg-gray-50 border border-gray-200"}`}>
                <p className={`text-sm font-black mb-2 ${dm ? "text-white" : "text-gray-800"}`}>Consistency Chart (WPM)</p>
                {chartPoints ? (
                  <svg viewBox="0 0 300 110" className="w-full h-32">
                    <line x1="0" y1="100" x2="300" y2="100" stroke={dm ? "#4b5563" : "#d1d5db"} strokeWidth="1" />
                    <polyline
                      points={chartPoints}
                      fill="none"
                      stroke={dm ? "#22d3ee" : "#4f46e5"}
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <p className={`text-xs ${dm ? "text-gray-500" : "text-gray-500"}`}>
                    Complete a typing test to generate chart data.
                  </p>
                )}
              </div>

              <div className={`p-4 rounded-2xl ${dm ? "bg-gray-800/70 border border-red-700/40" : "bg-red-50 border border-red-200"}`}>
                <p className={`text-sm font-black mb-2 ${dm ? "text-red-300" : "text-red-700"}`}>Delete Account</p>
                <p className={`text-xs mb-3 ${dm ? "text-gray-400" : "text-red-700/80"}`}>
                  This permanently deletes your account, photo, and saved performance records from this browser.
                </p>
                <InputField
                  label='Type "DELETE" to confirm'
                  value={deleteConfirm}
                  onChange={setDeleteConfirm}
                  dm={dm}
                  placeholder="DELETE"
                />
                <button
                  onClick={handleDelete}
                  className="w-full mt-2 py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-red-600 to-rose-500"
                >
                  Permanently Delete Account
                </button>
              </div>

              <div className={`p-4 rounded-2xl ${dm ? "bg-gray-800/60 border border-gray-700" : "bg-gray-50 border border-gray-200"}`}>
                <p className={`text-sm font-black mb-2 ${dm ? "text-white" : "text-gray-800"}`}>Recent Activity</p>
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {records.length === 0 && (
                    <p className={`text-xs ${dm ? "text-gray-500" : "text-gray-500"}`}>
                      No records yet.
                    </p>
                  )}
                  {[...records].reverse().slice(0, 10).map((record) => (
                    <div
                      key={record.id}
                      className={`p-2 rounded-lg text-xs ${
                        dm ? "bg-gray-900/70 text-gray-300" : "bg-white text-gray-700"
                      }`}
                    >
                      <p className="font-semibold">
                        {record.type === "typing"
                          ? `Typing • ${record.wpm} WPM • ${record.accuracy}%`
                          : `Arrow • Score ${record.score} • ${record.accuracy}% hit`}
                      </p>
                      <p className={dm ? "text-gray-500" : "text-gray-500"}>
                        {new Date(record.timestamp).toLocaleString()} • {record.duration / 60} min
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {statusMsg && (
            <div className={`mt-4 text-xs font-semibold ${dm ? "text-cyan-300" : "text-indigo-700"}`}>
              {statusMsg}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function AuthTab({
  label,
  active,
  onClick,
  dm,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  dm: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-all ${
        active
          ? dm
            ? "bg-cyan-600 text-white"
            : "bg-indigo-600 text-white"
          : dm
          ? "text-gray-400"
          : "text-gray-500"
      }`}
    >
      {label}
    </button>
  );
}

function InputField({
  label,
  value,
  onChange,
  dm,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  dm: boolean;
  placeholder: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className={`text-xs font-semibold uppercase tracking-wider ${dm ? "text-gray-400" : "text-gray-500"}`}>
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`mt-1 w-full px-3 py-2.5 rounded-xl outline-none border text-sm transition-all ${
          dm
            ? "bg-gray-800 text-white border-gray-700 focus:border-cyan-500"
            : "bg-white text-gray-800 border-gray-200 focus:border-indigo-400"
        }`}
      />
    </label>
  );
}

function MetricCard({ label, value, dm }: { label: string; value: string; dm: boolean }) {
  return (
    <div className={`p-2 rounded-lg ${dm ? "bg-gray-900/70" : "bg-white"}`}>
      <p className={`text-[10px] font-semibold uppercase ${dm ? "text-gray-500" : "text-gray-500"}`}>{label}</p>
      <p className={`text-lg font-black ${dm ? "text-white" : "text-gray-800"}`}>{value}</p>
    </div>
  );
}