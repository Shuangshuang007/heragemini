# Héra Career Switch API - 独立部署指南

## 📦 部署包内容

```
career_switch_deploy/
├── career_api_server.js       # 主服务文件
├── graph_data/                # 图谱数据
│   ├── nodes.csv             # 51,283 职位节点
│   ├── edges.csv             # 134,755 转职边
│   └── stats.json            # 统计信息
├── package.json              # 依赖配置
├── ecosystem.config.js       # PM2配置
├── .env.example              # 环境变量示例
└── README.md                 # 本文件
```

---

## 🚀 Vultr部署步骤

### 1️⃣ 上传到Vultr服务器

```bash
# 在本地打包
cd /Users/shuangshuangwu/Desktop
tar -czf career_switch_deploy.tar.gz career_switch_deploy/

# 上传到Vultr (替换为你的服务器IP和路径)
scp career_switch_deploy.tar.gz root@your-vultr-ip:/opt/

# SSH登录Vultr
ssh root@your-vultr-ip

# 解压
cd /opt
tar -xzf career_switch_deploy.tar.gz
cd career_switch_deploy
```

---

### 2️⃣ 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件
nano .env
```

填写实际值：
```env
MONGO_URI=mongodb://your-mongodb-host:27017/CareerSwitch
CAREER_OPENAI_KEY=sk-proj-xxxxx
PORT=3009
GRAPH_DATA_PATH=./graph_data
```

---

### 3️⃣ 安装依赖

```bash
# 安装Node.js依赖
npm install

# 检查图谱数据是否完整
ls -lh graph_data/
# 应该看到: nodes.csv, edges.csv, stats.json
```

---

### 4️⃣ 启动服务 (使用PM2)

```bash
# 安装PM2 (如果还没有)
npm install -g pm2

# 启动Career Switch API
pm2 start ecosystem.config.js

# 查看状态
pm2 status

# 查看日志
pm2 logs career-switch-api

# 设置开机自启
pm2 save
pm2 startup
```

---

### 5️⃣ 测试API

```bash
# 健康检查
curl http://localhost:3009/health

# 测试API (从外网访问需要开放3009端口)
curl http://your-vultr-ip:3009/health

# 测试职业建议 (raw模式)
curl -X POST http://localhost:3009/api/career/advice \
  -H "Content-Type: application/json" \
  -d '{
    "currentJob": "Software Engineer",
    "experience": 3,
    "mode": "raw"
  }'

# 测试职业建议 (report模式)
curl -X POST http://localhost:3009/api/career/advice \
  -H "Content-Type: application/json" \
  -d '{
    "currentJob": "Product Manager",
    "experience": 2,
    "mode": "report"
  }'
```

---

## 🔥 防火墙配置

需要开放端口3009：

```bash
# UFW (Ubuntu)
ufw allow 3009/tcp

# Firewalld (CentOS)
firewall-cmd --permanent --add-port=3009/tcp
firewall-cmd --reload

# 或者在Vultr控制台配置防火墙规则
```

---

## 📊 PM2 管理命令

```bash
# 查看状态
pm2 status

# 重启服务
pm2 restart career-switch-api

# 停止服务
pm2 stop career-switch-api

# 查看日志
pm2 logs career-switch-api --lines 100

# 监控
pm2 monit
```

---

## ⚠️ 重要提示

### 1. **完全独立部署**
- ✅ Career Switch API 运行在端口 **3009**
- ✅ **不会影响** Resume PDF 或其他已有服务
- ✅ 独立的 PM2 进程名: `career-switch-api`
- ✅ 独立的日志文件: `./logs/career-*.log`

### 2. **数据不依赖实时MongoDB**
- ✅ 图谱数据已经预生成 (nodes.csv, edges.csv)
- ✅ API启动时加载到**内存**，速度极快
- ⚠️ MongoDB只用于**可选的**用户数据存储（如果需要）

### 3. **资源占用**
- 内存: ~200-300MB (图谱数据在内存)
- CPU: 低 (除非GPT生成报告时)
- 磁盘: ~50MB (代码 + 图谱数据)

---

## 🔗 集成到Heraai

部署成功后，在Heraai配置：

```env
# Heraai .env.local (本地测试)
CAREER_SWITCH_API_URL=http://your-vultr-ip:3009

# Vercel环境变量 (生产)
CAREER_SWITCH_API_URL=http://your-vultr-ip:3009
```

---

## ❓ 故障排查

### API无法访问
```bash
# 检查进程
pm2 status

# 检查日志
pm2 logs career-switch-api

# 检查端口
netstat -tlnp | grep 3009

# 重启服务
pm2 restart career-switch-api
```

### GPT报告生成失败
```bash
# 检查OpenAI Key是否正确
cat .env | grep CAREER_OPENAI_KEY

# 查看详细错误日志
pm2 logs career-switch-api --lines 200
```

---

## 📞 支持

部署问题请检查：
1. Node.js版本 >= 18
2. MongoDB连接 (如果使用)
3. OpenAI API Key配置
4. 防火墙端口3009开放
5. PM2进程正常运行

