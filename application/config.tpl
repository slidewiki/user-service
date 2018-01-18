{
  "server": {
    "protocol": "http",
    "host": "userservice.experimental.slidewiki.org"
  },
  "github": {
    "key": "",
    "secret": "",
    "callback": "/social/provider/github",
    "scope": ["read:user,user:email"]
  },
  "google": {
    "key": "",
    "secret": "",
    "callback": "/social/provider/google",
    "scope": ["https://www.googleapis.com/auth/plus.me", "https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile"],
    "custom_params": {
      "access_type": "offline"
    }
  },
  "facebook": {
    "key": "",
    "secret": "",
    "callback": "/social/provider/facebook",
    "scope": ["email,public_profile,user_about_me"]
  }
}
