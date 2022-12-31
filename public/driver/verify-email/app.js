const origin = "http://localhost:3000";

const params = new Proxy(new URLSearchParams(window.location.search), {
  get: (searchParams, prop) => searchParams.get(prop),
});
// Get the value of "some_key" in eg "https://example.com/?some_key=some_value"
let email = params.email; // "some_value"
let token = params.token; // "some_value"

const textEl = document.querySelector(".loading");

const verifyEmail = async () => {
  try {
    const res = await fetch(`${origin}/api/v1/auth/verify-driver-email`, {
      body: JSON.stringify({ email: email, token: token }),
      method: "post",
      headers: { "Content-Type": "application/json" },
    });
    const result = await res.json();
    textEl.textContent = result.msg;
  } catch (e) {
    console.log(e);
    textEl.textContent = e;
  }
};

verifyEmail();
