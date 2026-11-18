# Ubuntu 24.04 VPS setup for production Docker hosting

This runbook prepares the `178.128.121.247` VPS for the ATA application. It is
host preparation only: do not copy or edit application code, Compose files, or
environment configuration while following it.

## Target state

- Ubuntu 24.04 LTS
- SSH key authentication for the `deploy` user
- Docker Engine from Docker's official apt repository
- Docker Compose CLI plugin (`docker compose`)
- UFW default-deny firewall with only TCP 22, 80, and 443 allowed
- 2 GiB swap file
- Automatic Ubuntu security updates
- Empty deployment directories under `/var/www/ata`

## 1. First login and SSH keys

Generate a local key if one does not already exist:

```bash
ssh-keygen -t ed25519 -a 100 -C "ata-vps-deploy" -f ~/.ssh/ata_vps_ed25519
```

For a new DigitalOcean image, select this public key during the rebuild/create
flow. Otherwise install it for the initial account:

```bash
ssh-copy-id -i ~/.ssh/ata_vps_ed25519.pub root@178.128.121.247
ssh -i ~/.ssh/ata_vps_ed25519 root@178.128.121.247
```

On the VPS, update packages and create the deployment account:

```bash
apt update
DEBIAN_FRONTEND=noninteractive apt -y full-upgrade
apt -y install ca-certificates curl ufw unattended-upgrades

adduser --disabled-password --gecos "" deploy
usermod -aG sudo deploy
install -d -o deploy -g deploy -m 0700 /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys
chmod 0600 /home/deploy/.ssh/authorized_keys

cat >/etc/sudoers.d/90-deploy <<'EOF'
deploy ALL=(ALL:ALL) NOPASSWD:ALL
EOF
chmod 0440 /etc/sudoers.d/90-deploy
visudo -cf /etc/sudoers.d/90-deploy
```

Keep the root session open. From a second local terminal, verify the new login
before changing SSH policy:

```bash
ssh -i ~/.ssh/ata_vps_ed25519 deploy@178.128.121.247
sudo -v
```

The `deploy` account is key-only and has passwordless sudo so unattended
deployments and maintenance do not depend on a shared account password. Treat
its private SSH key as a root credential and limit who can use it.

Optional production hardening, only after the second login succeeds:

```bash
sudo tee /etc/ssh/sshd_config.d/99-ata-hardening.conf >/dev/null <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
PubkeyAuthentication yes
EOF
sudo sshd -t
sudo systemctl reload ssh
```

`PermitRootLogin prohibit-password` keeps emergency key-based root access while
disabling root password login. It can be changed to `no` later after console
access and `deploy` sudo access have both been tested.

## 2. Install Docker Engine and Compose

Run these commands as `deploy` (or prefix them with `sudo` from another sudo
account). They use Docker's official Ubuntu apt repository:

```bash
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

sudo tee /etc/apt/sources.list.d/docker.sources >/dev/null <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF

sudo apt update
sudo apt -y install \
  docker-ce \
  docker-ce-cli \
  containerd.io \
  docker-buildx-plugin \
  docker-compose-plugin

sudo systemctl enable --now docker
sudo usermod -aG docker deploy
```

Log out and back in so the new `docker` group membership takes effect, then
verify it without `sudo`:

```bash
docker version
docker compose version
docker run --rm hello-world
```

Membership in the `docker` group is effectively root-level access. Grant it
only to trusted deployment administrators.

## 3. Configure UFW

Keep the current SSH session open while applying these rules:

```bash
sudo ufw --force reset
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp comment 'SSH'
sudo ufw allow 80/tcp comment 'HTTP'
sudo ufw allow 443/tcp comment 'HTTPS'
sudo ufw --force enable
sudo ufw status verbose
```

Open a second terminal and confirm that SSH still works before closing the first
session.

Important: Docker-published container ports can bypass UFW's normal packet
path. UFW alone does not make a port private if Compose publishes it. Publish
only the intended public HTTP/HTTPS ports, bind internal services to loopback,
or leave them on Docker-internal networks. Database, cache, admin, and debug
ports must not be published on `0.0.0.0`. Changing those bindings belongs to a
separate application/Compose deployment task.

If a DigitalOcean Cloud Firewall is attached, mirror the same inbound TCP
rules (22, 80, and 443) there. Restrict TCP 22 to known administrator source IPs
when operationally possible.

## 4. Create 2 GiB swap

A 2 GiB swap file is recommended for this 2 GiB VPS to reduce the chance of an
out-of-memory kill during image builds or deployments. Swap is not a substitute
for memory capacity.

```bash
if ! sudo swapon --show=NAME --noheadings | grep -qx '/swapfile'; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 0600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
fi

grep -qE '^/swapfile[[:space:]]' /etc/fstab || \
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

sudo tee /etc/sysctl.d/99-ata-memory.conf >/dev/null <<'EOF'
vm.swappiness=10
EOF
sudo sysctl --system

swapon --show
free -h
```

## 5. Create `/var/www/ata`

Create the empty host-side layout without copying application files or secrets:

```bash
sudo install -d -o deploy -g deploy -m 0755 /var/www/ata
sudo install -d -o deploy -g deploy -m 0755 /var/www/ata/app
sudo install -d -o deploy -g deploy -m 0750 /var/www/ata/data
sudo install -d -o deploy -g deploy -m 0750 /var/www/ata/logs
sudo install -d -o deploy -g deploy -m 0700 /var/www/ata/backups
sudo install -d -o deploy -g deploy -m 0700 /var/www/ata/secrets
```

```text
/var/www/ata/
├── app/       # future application checkout; intentionally empty now
├── data/      # persistent bind-mounted application data
├── logs/      # host-persisted service logs, if required
├── backups/   # local staging for protected backups
└── secrets/   # deployment secrets; never commit; mode 0700
```

The `deploy` user owns this tree. Do not place Compose or environment files in
it during VPS preparation. Off-host backups are still required; the local
`backups` directory does not protect against VPS or disk loss.

## 6. Enable unattended security updates

Ubuntu 24.04 Server normally includes `unattended-upgrades`; the commands below
make the desired periodic behavior explicit without modifying the package's
vendor configuration file:

```bash
sudo apt update
sudo apt -y install unattended-upgrades

sudo tee /etc/apt/apt.conf.d/20auto-upgrades >/dev/null <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF

sudo systemctl enable --now apt-daily.timer apt-daily-upgrade.timer
sudo unattended-upgrade --dry-run --debug
systemctl list-timers 'apt-daily*'
```

Security update logs are stored at
`/var/log/unattended-upgrades/unattended-upgrades.log`. Automatic reboot is not
enabled here; monitor `/var/run/reboot-required` and schedule controlled reboots
after kernel or critical library updates.

## 7. Verification checklist

Run the checks as `deploy` after logging out and back in:

```bash
# Host and OS
hostnamectl
cat /etc/os-release

# Docker Engine and Compose
systemctl is-enabled docker
systemctl is-active docker
docker version
docker compose version
docker ps

# Listening TCP/UDP ports and firewall policy
sudo ss -tulpn
sudo ufw status numbered

# Filesystem capacity and deployment directory permissions
df -hT
sudo du -sh /var/lib/docker /var/www/ata
find /var/www/ata -maxdepth 1 -printf '%M %u:%g %p\n' | sort

# RAM and swap
free -h
swapon --show

# Security update scheduling
systemctl is-enabled apt-daily.timer apt-daily-upgrade.timer
systemctl list-timers 'apt-daily*'
test ! -e /var/run/reboot-required || cat /var/run/reboot-required.pkgs
```

Expected results:

- Ubuntu reports version `24.04`.
- Docker is enabled and active, and `docker ps` works as `deploy`.
- `docker compose version` reports the Compose plugin.
- UFW is active with inbound allow rules only for TCP 22, 80, and 443.
- Before the application is deployed, `ss` should normally show only SSH on a
  public TCP socket; ports 80 and 443 are allowed but need not be listening yet.
- `/var/www/ata` is owned by `deploy:deploy`; `backups` and `secrets` are mode
  `0700`.
- Approximately 2 GiB of swap is active and `/swapfile` is present in
  `/etc/fstab`.
- Both apt timers are enabled.

## References

- [Install Docker Engine on Ubuntu](https://docs.docker.com/engine/install/ubuntu/)
- [Docker Engine Linux post-installation](https://docs.docker.com/engine/install/linux-postinstall/)
- [Ubuntu security updates](https://documentation.ubuntu.com/security/security-updates/)
