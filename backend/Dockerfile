FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["SmartKB/SmartKB.csproj", "SmartKB/"]
RUN dotnet restore "SmartKB/SmartKB.csproj"
COPY . .
RUN dotnet publish "SmartKB/SmartKB.csproj" -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0

# Install Python, pip, and bash (needed for startup script)
RUN apt-get update && \
    apt-get install -y python3 python3-pip bash && \
    rm -rf /var/lib/apt/lists/*

# Copy Python service files from build context
WORKDIR /app/python
COPY SmartKB/Python/requirements.txt .
COPY SmartKB/Python/embedding_service.py .

# Install Python dependencies
RUN pip3 install --no-cache-dir -r requirements.txt

# Copy startup script and make it executable
COPY SmartKB/Python/start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Copy .NET app
WORKDIR /app
COPY --from=build /app/publish .

EXPOSE 8080
EXPOSE 5000
ENV ASPNETCORE_URLS=http://+:8080
ENV PYTHON_SERVICE_URL=http://localhost:5000

ENTRYPOINT ["/bin/bash", "/app/start.sh"]
