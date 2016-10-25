{
  "server": {
    "protocol": "http",
    "host": "authorizationservice.manfredfris.ch:3000"
  },
  "github": {
    "key": "",
    "secret": "",
    "callback": "/handle_github_callback",
    "scope": ["user"]
  },
  "google": {
    "key": "",
    "secret": "",
    "callback": "/social/google",
    "scope": ["https://www.googleapis.com/auth/plus.me", "https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile"],
    "custom_params": {
      "access_type": "offline"
    }
  }
}
