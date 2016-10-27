'use strict';

const Purest = require('purest');

module.exports = {
  //functions which using OAuth2 token to get user information
  //try a generic one
  getUserCredentials: function(token, provider) {
    // console.log('Lets do API access with our token', token, provider);

    let myPromise = new Promise((resolve, reject) => {
      let providerInstance = new Purest({
        provider: provider
      });

      const handleReponse = (err, res, body) => {
        if (err) {
          console.log('getUserCredentials: request error: ', err);
          reject({wrongCredentials: true, origin: err});
        }
        // console.log('getUserCredentials: body: ', body);

        let user = {};

        switch (provider) {
          case 'github':
            user = getUserFromGithubResponse(body);
            break;
          case 'google':
            user = getUserFromGoogleResponse(body);
            break;
        }
        user.provider = provider;
        user.origin = body;

        if (provider === 'github' && (user.email === undefined || user.email === null)) {
          getEmailFromGithub(token)
            .then((email) => {
              //find correct email
              try {
                let emailaddress = email.find((element) => {return (element.primary) ? element.email : false; }).email;

                user.email = emailaddress;
                user.origin.email = email;
              } catch (e) {
                //nothing
              }

              resolve(user);
            })
            .catch((error) => {
              reject(error);
            });
        }
        else
          resolve(user);
      };

      try {
        switch (provider) {
          case 'google':
            providerInstance.get('https://www.googleapis.com/userinfo/v2/me', {
              auth: {
                bearer: token
              },
              headers: {
                'User-Agent': 'SlideWiki'
              }
            }, handleReponse);
            break;
          default:
            providerInstance.query()
              .select('user')
              .auth(token)
              .headers({
                'User-Agent': 'SlideWiki'
              })
              .request(handleReponse);
            break;
        }
      } catch (e) {
        console.log('Error', e);
        reject(e);
      }
    });

    return myPromise;
  }
};

function getUserFromGithubResponse(body) {
  return {
    nickname: body.login,
    id: body.id,
    url: body.html_url,
    name: body.name,
    company: body.company,
    location: body.location,
    organization: body.company,
    description: body.bio,
    picture: body.avatar_url,
    email: body.email //null at the moment ...
  };
}

function getUserFromGoogleResponse(body) {
  let user = {
    name: body.name,
    location: body.locale,
    url: body.link,
    id: body.id,
    email: body.email,
    picture: body.picture
  };
  try {
    user.nickname = body.email.substring(0, body.email.indexOf('@'));
  } catch (e) {}

  return user;
}

function getEmailFromGithub(token) {
  let myPromise = new Promise((resolve, reject) => {
    let providerInstance = new Purest({
      provider: 'github'
    });

    const handleReponse = (err, res, body) => {
      if (err) {
        reject(err);
      }

      resolve(body);
    };

    try {
      providerInstance.get('https://api.github.com/user/emails', {
        auth: {
          bearer: token
        },
        headers: {
          'User-Agent': 'SlideWiki'
        }
      }, handleReponse);
    } catch (e) {
      console.log('Error', e);
      reject(e);
    }
  });

  return myPromise;
}
