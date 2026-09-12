-- CreateTable
CREATE TABLE "User" (
    "email" TEXT NOT NULL PRIMARY KEY,
    "password" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
