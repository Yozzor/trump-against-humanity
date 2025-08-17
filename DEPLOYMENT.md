# 🚀 Trump Against Humanity - Deployment Guide

## Overview
This application uses a **split-stack deployment**:
- **Frontend**: Static files hosted on Namecheap
- **Backend**: Node.js server hosted on Render
- **Version Control**: GitHub repository

## 📋 Pre-Deployment Checklist

### ✅ Completed
- [x] GitHub repository created and code pushed
- [x] Backend configured for production with environment variables
- [x] Frontend configured with environment-based backend URLs
- [x] Health check endpoints added to backend
- [x] CORS configuration for cross-domain communication

### 🔄 Next Steps
- [ ] Deploy backend to Render
- [ ] Update frontend configuration with Render URL
- [ ] Upload frontend to Namecheap
- [ ] Test complete application

## 🎯 Deployment Steps

### Step 1: Deploy Backend to Render
1. Create Render account at render.com
2. Connect GitHub repository
3. Create new Web Service
4. Configure environment variables:
   - `NODE_ENV=production`
   - `FRONTEND_URL=https://yourdomain.com`
5. Deploy and get production URL

### Step 2: Update Frontend Configuration
1. Edit `js/config.js`
2. Update the production backend URL:
   ```javascript
   return 'https://your-render-app.onrender.com';
   ```
3. Test locally with production backend

### Step 3: Upload Frontend to Namecheap
1. Access cPanel File Manager
2. Navigate to public_html
3. Upload all frontend files:
   - index.html
   - css/ folder
   - js/ folder
   - images/ folder
4. Test website accessibility

### Step 4: Final Testing
1. Test website loads correctly
2. Test multiplayer game functionality
3. Verify Socket.io connections work
4. Test across different devices/browsers

## 🔧 Configuration Files

### Backend Environment Variables (Render)
```
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://yourdomain.com
ALLOWED_ORIGINS=https://www.yourdomain.com
```

### Frontend Configuration (js/config.js)
```javascript
// Update this URL after Render deployment
return 'https://your-render-app.onrender.com';
```

## 🌐 URLs After Deployment
- **Frontend**: https://yourdomain.com
- **Backend**: https://your-render-app.onrender.com
- **Health Check**: https://your-render-app.onrender.com/health
- **API Status**: https://your-render-app.onrender.com/api/status

## 🐛 Troubleshooting

### Common Issues
1. **CORS Errors**: Update FRONTEND_URL in Render environment variables
2. **Socket.io Connection Failed**: Check backend URL in js/config.js
3. **Files Not Loading**: Verify all files uploaded to public_html
4. **Game Not Working**: Check browser console for errors

### Debug Steps
1. Check browser console for errors
2. Verify backend health: visit /health endpoint
3. Test Socket.io connection in browser dev tools
4. Check Render logs for backend errors

## 📞 Support
If you encounter issues:
1. Check browser console for error messages
2. Verify all URLs are correct
3. Test backend health endpoint
4. Check Render deployment logs
