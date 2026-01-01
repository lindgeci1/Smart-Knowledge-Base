FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["SmartKB/SmartKB.csproj", "SmartKB/"]
RUN dotnet restore "SmartKB/SmartKB.csproj"
COPY . .
RUN dotnet publish "SmartKB/SmartKB.csproj" -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /app/publish .
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
ENTRYPOINT ["dotnet", "SmartKB.dll"]
