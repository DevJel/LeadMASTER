-- Account-scoped audience records. Imports store only normalized email addresses.
CREATE TABLE audience_contacts (
 account_id TEXT NOT NULL,
 email TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 PRIMARY KEY (account_id,email)
);
CREATE TABLE audience_groups (
 id TEXT PRIMARY KEY,
 account_id TEXT NOT NULL,
 name TEXT NOT NULL COLLATE NOCASE,
 created_at INTEGER NOT NULL,
 UNIQUE (account_id,name),
 UNIQUE (account_id,id)
);
CREATE TABLE audience_group_members (
 account_id TEXT NOT NULL,
 group_id TEXT NOT NULL,
 email TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 PRIMARY KEY (account_id,group_id,email),
 FOREIGN KEY (account_id,group_id) REFERENCES audience_groups(account_id,id),
 FOREIGN KEY (account_id,email) REFERENCES audience_contacts(account_id,email)
);
CREATE INDEX idx_audience_groups_account ON audience_groups(account_id,name);
CREATE INDEX idx_audience_members_contact ON audience_group_members(account_id,email);
