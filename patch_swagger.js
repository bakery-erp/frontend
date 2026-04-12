const fs = require('fs');
const file = '/home/nebiyu/Desktop/Growth circle/ERP/server/src/config/swagger.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  `          branch: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } } },\n        },\n      },`,
  `          branch: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } } },\n          filesUrl: { type: 'string', nullable: true },\n          shift: { type: 'string', nullable: true },\n          salary: { type: 'number', nullable: true },\n          startDate: { type: 'string', format: 'date-time', nullable: true },\n          isActive: { type: 'boolean' },\n        },\n      },`
);

const passwordDoc = `
  /auth/password:
    patch:
      summary: Update own password
      tags: [Auth]
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [currentPassword, newPassword]
              properties:
                currentPassword:
                  type: string
                  example: "oldpass123"
                newPassword:
                  type: string
                  example: "newpass123"
      responses:
        200:
          description: Password updated successfully
        400:
          description: Validation error
        401:
          description: Incorrect current password
        404:
          description: User not found
`;

code = code.replace(
  `  /auth/me:\n    get:\n      summary: Get current authenticated user`,
  `${passwordDoc}\n  /auth/me:\n    get:\n      summary: Get current authenticated user`
);

fs.writeFileSync(file, code);
