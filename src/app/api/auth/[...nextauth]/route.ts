import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import LinkedInProvider from "next-auth/providers/linkedin";

// 判断是否为 heraai.one 域名（包括 www.heraai.one）
const isOneHost = (host?: string | null): boolean => {
  if (!host) return false;
  return host.toLowerCase().includes("heraai.one");
};

// 将 NextAuth 改为函数形式，根据域名动态选择 GitHub OAuth 凭证
export const { handlers, auth } = NextAuth((req) => {
  // 从 request headers 获取 host
  const host = req.headers.get("host") || req.headers.get("x-forwarded-host");
  
  // 根据域名选择 GitHub OAuth 凭证
  const githubClientId = isOneHost(host)
    ? process.env.GITHUB_CLIENT_ID_ONE!
    : process.env.GITHUB_CLIENT_ID!;
  
  const githubClientSecret = isOneHost(host)
    ? process.env.GITHUB_CLIENT_SECRET_ONE!
    : process.env.GITHUB_CLIENT_SECRET!;

  return {
    debug: true, // 调试期先开着
    providers: [
      LinkedInProvider({
        clientId: process.env.LINKEDIN_CLIENT_ID!,
        clientSecret: process.env.LINKEDIN_CLIENT_SECRET!,

        // 让 NextAuth 使用 LinkedIn 的 OIDC 配置
        wellKnown: "https://www.linkedin.com/oauth/.well-known/openid-configuration",

        // 只保留 params；不要自定义 authorization.url/token.url/userinfo.url/issuer
        authorization: { params: { scope: "openid profile email" } },

        // 可留，可删都行；留着不影响
        client: { token_endpoint_auth_method: "client_secret_post" },

        // OIDC 的用户映射
        profile(p: any) {
          return {
            id: p.sub,
            name: p.name ?? [p.given_name, p.family_name].filter(Boolean).join(" "),
            email: p.email,
            image: p.picture,
          };
        },
      }),
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        authorization: {
          params: {
            prompt: "select_account"
          }
        }
      }),
      // ✅ 根据域名动态选择 GitHub OAuth 凭证
      GitHubProvider({
        clientId: githubClientId,
        clientSecret: githubClientSecret,
      }),
    ],
    callbacks: {
      async signIn({ user, account, profile }) {
        // 可在此同步用户信息到数据库
        return true;
      },
      async jwt({ token, user, account }) {
        // 将用户邮箱添加到token中
        if (user?.email) {
          token.registeredEmail = user.email;
        }
        return token;
      },
      async session({ session, token, user }) {
        // 将registeredEmail添加到session中
        if (token.registeredEmail && typeof token.registeredEmail === 'string') {
          session.registeredEmail = token.registeredEmail;
        }
        return session;
      },
      async redirect() {
        return "/profile";
      },
    },
    session: {
      strategy: "jwt",
      maxAge: 30 * 24 * 60 * 60, // 30天
    },
  };
});

export { handlers as GET, handlers as POST }; 