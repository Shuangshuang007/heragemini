import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import LinkedInProvider from "next-auth/providers/linkedin";

const handler = NextAuth({
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
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
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
});

export { handler as GET, handler as POST }; 