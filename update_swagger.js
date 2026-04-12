const fs = require('fs');
const file = '/home/nebiyu/Desktop/Growth circle/ERP/server/src/config/swagger.ts';
let code = fs.readFileSync(file, 'utf8');

const passwordRoute = `
    '/api/auth/password': {
      patch: {
        tags: ['Auth'],
        summary: 'Update logged-in user password',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['currentPassword', 'newPassword'],
                properties: {
                  currentPassword: { type: 'string', example: 'old123' },
                  newPassword: { type: 'string', example: 'new123' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Password updated successfully' },
          400: { description: 'Missing fields' },
          401: { description: 'Incorrect current password' },
          404: { description: 'User not found' }
        }
      }
    },`;

if (!code.includes("'/api/auth/password'")) {
  code = code.replace("'/api/auth/me': {", passwordRoute + "\n    '/api/auth/me': {");
}

fs.writeFileSync(file, code);
