from locust import HttpUser, task, between

class HumanUser(HttpUser):
    """
    Simulates a legitimate human user with realistic navigation intervals
    and human-like behavior (2 to 5 seconds between actions).
    """
    wait_time = between(2, 5)

    @task(3)
    def view_health(self):
        self.client.get("/health")

    @task(2)
    def normal_login_attempt(self):
        self.client.post("/api/auth/login", json={
            "email": "nirlonmacwan27@gmail.com",
            "password": "Password123!"
        })

    @task(1)
    def view_profile(self):
        self.client.get("/api/profile", headers={
            "Authorization": "Bearer fake_test_token"
        })

class AutomatedBot(HttpUser):
    """
    Simulates an aggressive automated bot making rapid burst requests
    with consistent high-frequency timing (0.05 to 0.1 seconds between actions).
    """
    wait_time = between(0.05, 0.1)

    @task
    def credential_stuffing_burst(self):
        self.client.post("/api/auth/login", json={
            "email": "bot_target@example.com",
            "password": "wrong_password_attempt"
        }, headers={
            "User-Agent": "AutomatedBot-Scanner/1.0"
        })
