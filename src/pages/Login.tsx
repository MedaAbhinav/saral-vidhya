import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { loadCredentials } from "@/utils/credentialsStore";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "@/services/firebase";
import logo from "../logo.png";

function Login() {

  const navigate = useNavigate();
  const location = useLocation();

  const from =
    (location.state as { from?: string })?.from || "/";

  const [studentPassword, setStudentPassword] = useState("");
  const [studentError, setStudentError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // LOGIN FUNCTION
  const handleStudentLogin = (
    e: React.FormEvent
  ) => {

    e.preventDefault();

    setStudentError("");

    if (!studentPassword) {
      setStudentError("Please enter password");
      return;
    }

    setLoading(true);

    setTimeout(() => {

      const creds = loadCredentials();

      const match = creds.find(
        c =>
          c.role === "student" &&
          c.password === studentPassword
      );

      if (match) {

        localStorage.setItem(
          "app_authenticated",
          "true"
        );

        localStorage.setItem(
          "app_role",
          match.role
        );

        localStorage.setItem(
          "username",
          match.username
        );

        navigate(from, { replace: true });

      } else {

        setStudentError(
          "Incorrect password"
        );

        setLoading(false);
      }

    }, 400);
  };

  const handleGoogleLogin = async () => {
    setStudentError("");
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      
      localStorage.setItem("app_authenticated", "true");
      localStorage.setItem("app_role", "student");
      localStorage.setItem("app_user_id", result.user.uid);
      localStorage.setItem("username", result.user.displayName || result.user.email || "Student");
      
      navigate(from, { replace: true });
    } catch (error: any) {
      setStudentError(error.message || "Google Login Failed");
      setLoading(false);
    }
  };

  return (

    <div className="login-container">

      <div className="login-card">

        {/* LEFT SIDE */}
        <div className="left-section">

          <img
            src={logo}
            alt="logo"
            className="logo"
          />

        </div>

        {/* RIGHT SIDE */}
        <div className="right-section">

          {/* Google Login Top Right */}
          <button
            type="button"
            style={{
              position: "absolute",
              top: "24px",
              right: "24px",
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              background: "#fff",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              border: "none",
              cursor: "pointer",
              boxShadow: "0 4px 15px rgba(0, 0, 0, 0.1)",
              transition: "transform 0.3s ease",
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
            disabled={loading}
            onClick={handleGoogleLogin}
            aria-label="Sign in with Google"
            title="Sign in with Google"
          >
            <svg width="24" height="24" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.7 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.9c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.13-10.36 7.13-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              <path fill="none" d="M0 0h48v48H0z"/>
            </svg>
          </button>

          <form
            onSubmit={handleStudentLogin}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "28px"
            }}
          >

            <div className="password-field">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                className="password-input"
                value={studentPassword}
                onChange={(e) => {
                  setStudentPassword(
                    e.target.value
                  );
                  setStudentError("");
                }}
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "🙈" : "👁"}
              </button>
            </div>

            <button
              type="submit"
              className="login-btn"
              disabled={loading}
            >
              {loading ? "Loading..." : "Login"}
            </button>

          </form>

          {/* ERROR MESSAGE */}
          {studentError && (
            <p
              style={{
                color: "white",
                fontSize: "14px",
                marginTop: "-10px",
                fontWeight: 500
              }}
            >
              {studentError}
            </p>
          )}

        </div>

      </div>

    </div>
  );
}

export default Login;