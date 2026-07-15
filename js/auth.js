// 구글 로그인 게이트
function showAuthGate(message) {
  document.getElementById('auth-gate').hidden = false;
  document.querySelector('.app').hidden = true;
  document.getElementById('auth-error').textContent = message || '';
}
function showApp(user) {
  document.getElementById('auth-gate').hidden = true;
  document.querySelector('.app').hidden = false;
  document.getElementById('user-email').textContent = user.email || '';
  const avatar = document.getElementById('user-avatar');
  if (user.user_metadata && user.user_metadata.avatar_url) {
    avatar.src = user.user_metadata.avatar_url;
    avatar.hidden = false;
  } else {
    avatar.hidden = true;
  }
}

async function handleSession(session) {
  if (session && session.user) {
    showApp(session.user);
    if (window.initApp) await window.initApp();
  } else {
    showAuthGate();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('google-login-btn').addEventListener('click', async () => {
    const { error } = await DB.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.href.split('#')[0].split('?')[0] },
    });
    if (error) showAuthGate('로그인에 실패했습니다: ' + error.message);
  });

  document.getElementById('logout-btn').addEventListener('click', async () => {
    await DB.auth.signOut();
  });

  DB.auth.onAuthStateChange((_event, session) => {
    handleSession(session);
  });

  DB.auth.getSession().then(({ data }) => handleSession(data.session));
});
